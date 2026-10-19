/**
 * A message the user sends while another agent is mid-run on the session's
 * thread waits for that run to end, then runs. The thread runtime reports the
 * thread blocked by the other agent's run; the message must not be dropped.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import type { EventCallback, SubscribeOptions } from '../../events/types';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

const reply = (text: string) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });

const requestAccess = createTool({
  id: 'request-access',
  description: 'Ask the user for access to a path.',
  inputSchema: z.object({ path: z.string() }),
  execute: async (_input, context) => {
    await context?.agent?.suspend?.({ kind: 'access_request' });
    return 'unreachable';
  },
});

const askForAccess = () =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'requestAccess',
        input: '{"path":"/x"}',
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });

/** Whether `promise` settles within `ms`. */
const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms))]);

/**
 * Delivers thread events to subscriptions made before `armed` 50ms late. A
 * backend whose subscriptions receive events independently gives no order
 * between them, so a wait can see an event before the session has recorded it.
 */
class LateEarlySubscribersPubSub extends EventEmitterPubSub {
  armed = false;
  #late = new Map<EventCallback, EventCallback>();

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
    if (this.armed || !topic.startsWith('agent.thread-stream.')) return super.subscribe(topic, cb, options);
    const late: EventCallback = (event, ack, nack) =>
      new Promise(resolve => setTimeout(resolve, 50)).then(() => cb(event, ack, nack));
    this.#late.set(cb, late);
    return super.subscribe(topic, late, options);
  }

  override async unsubscribe(topic: string, cb: EventCallback) {
    return super.unsubscribe(topic, this.#late.get(cb) ?? cb);
  }
}

/**
 * A session on a thread, plus another agent whose model call waits for
 * `releaseOther()`. With `otherParks`, the other agent then parks on a prompt
 * of its own instead of replying. With `sharedPubSub`, the other agent uses the
 * session agent's own pubsub, so both share one thread runtime. With
 * `lateEarlySubscribers`, thread subscriptions made before the test arms the
 * pubsub get events late.
 */
async function createHarness(
  id: string,
  durable: boolean,
  { otherParks = false, sharedPubSub = false, lateEarlySubscribers = false } = {},
) {
  const storage = new InMemoryStore();
  const cache = new InMemoryServerCache();
  const pubsub = new LateEarlySubscribersPubSub();
  pubsub.armed = !lateEarlySubscribers;
  const memory = new MockMemory({ storage });
  // What each agent's model was asked, one entry per model call.
  const prompts: string[] = [];
  const otherPrompts: string[] = [];
  let releaseOther!: () => void;
  const otherReleased = new Promise<void>(resolve => (releaseOther = resolve));

  const baseAgent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You help.',
    memory,
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return { stream: reply('here') };
      },
    }),
  });
  // Another agent that runs on the session's thread, as a goal judge or an
  // application's own `stream` call does.
  const otherAgent = new Agent({
    id: `${id}-other`,
    name: `${id} other`,
    instructions: 'You check.',
    ...(sharedPubSub ? { pubsub } : {}),
    memory,
    tools: { requestAccess },
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        otherPrompts.push(JSON.stringify(prompt));
        await otherReleased;
        return { stream: otherParks ? askForAccess() : reply('checked') };
      },
    }),
  });

  const agent = durable ? createDurableAgent({ agent: baseAgent, cache, pubsub }) : baseAgent;
  const mastra = new Mastra({
    agents: { [`${id}-agent`]: agent as any, [`${id}-other`]: otherAgent },
    logger: false,
    storage,
    cache,
    pubsub,
  });
  const registeredAgent = mastra.getAgent(`${id}-agent`);
  const controller = new AgentController({
    agent: registeredAgent,
    pubsub,
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  /** Start the other agent on the session's thread and wait until its model call is in flight. */
  const startOther = async () => {
    const output = await mastra.getAgent(`${id}-other`).stream('Is the work done?', {
      memory: { thread: session.thread.getId()!, resource: session.identity.getResourceId() },
    });
    await vi.waitFor(() => expect(otherPrompts).toHaveLength(1));
    return output;
  };

  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });

  return { session, sessionAgent: registeredAgent, pubsub, prompts, otherPrompts, errors, releaseOther, startOther };
}

describe.each([false, true])('a message sent while another agent runs on the thread, durable=%s', durable => {
  it('runs once the other run has ended', async () => {
    const h = await createHarness('waits', durable);
    const other = await h.startOther();

    let otherEnded = false;
    const sent = h.session.sendMessage({ content: 'Are you there?' }).then(() => otherEnded);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(h.prompts).toHaveLength(0);

    h.releaseOther();
    await other.consumeStream();
    otherEnded = true;

    // The message didn't return before the other run ended, and then ran as the session's own run.
    expect(await sent).toBe(true);
    expect(h.prompts).toHaveLength(1);
    expect(h.prompts[0]).toContain('Are you there?');
    expect(h.otherPrompts.join('')).not.toContain('Are you there?');
  });

  it('is dropped when Stop is pressed while it waits', async () => {
    const h = await createHarness('stopped', durable);
    const other = await h.startOther();

    const sent = h.session.sendMessage({ content: 'Are you there?' });
    await new Promise(resolve => setTimeout(resolve, 200));
    await h.session.abort();
    await sent;

    h.releaseOther();
    await other.consumeStream();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(h.prompts).toHaveLength(0);
  });

  it('says it was not sent when the other run is parked on a prompt of its own', async () => {
    const h = await createHarness('parked', durable, { otherParks: true });
    const other = await h.startOther();
    h.releaseOther();
    await other.consumeStream();
    expect(other.status).toBe('suspended');

    expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), 5_000)).toBe(true);

    expect(h.prompts).toHaveLength(0);
    expect(h.errors).toEqual([
      "Your message wasn't sent: another agent's run on this thread is waiting for an answer to its own prompt.",
    ]);
  });

  it("says it was not sent when the other run, on the session agent's pubsub, is parked on a prompt", async () => {
    const h = await createHarness('parked-shared', durable, { otherParks: true, sharedPubSub: true });
    const other = await h.startOther();
    h.releaseOther();
    await other.consumeStream();
    expect(other.status).toBe('suspended');

    expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), 5_000)).toBe(true);

    expect(h.prompts).toHaveLength(0);
    expect(h.errors).toEqual([
      "Your message wasn't sent: another agent's run on this thread is waiting for an answer to its own prompt.",
    ]);
  });

  it('stops waiting and says so when the other run parks on a prompt while the message waits', async () => {
    const h = await createHarness('parks-later', durable, { otherParks: true });
    const other = await h.startOther();

    const sent = h.session.sendMessage({ content: 'Are you there?' });
    await new Promise(resolve => setTimeout(resolve, 200));
    h.releaseOther();
    await other.consumeStream();
    expect(await settlesWithin(sent, 5_000)).toBe(true);

    expect(other.status).toBe('suspended');
    expect(h.prompts).toHaveLength(0);
    expect(h.errors).toHaveLength(1);
  });

  it('stops waiting when the park reaches the wait before the session has recorded it', async () => {
    const h = await createHarness('parks-recorded-late', durable, { otherParks: true, lateEarlySubscribers: true });
    const other = await h.startOther();

    h.pubsub.armed = true;
    const sent = h.session.sendMessage({ content: 'Are you there?' });
    await new Promise(resolve => setTimeout(resolve, 200));
    h.releaseOther();
    await other.consumeStream();
    expect(await settlesWithin(sent, 5_000)).toBe(true);

    expect(h.prompts).toHaveLength(0);
    expect(h.errors).toEqual([
      "Your message wasn't sent: another agent's run on this thread is waiting for an answer to its own prompt.",
    ]);
  });

  it('says the thread is still held when the wait ends but the same run still blocks it', async () => {
    const h = await createHarness('still-held', durable);
    const other = await h.startOther();
    // A wait that finds nothing to wait for, as for a run held in a process this one can't see.
    const wait = vi.spyOn(agentThreadStreamRuntime, 'waitForCrossAgentThreadRun').mockResolvedValue(undefined);
    try {
      expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), 5_000)).toBe(true);
      expect(wait).toHaveBeenCalledTimes(1);
    } finally {
      wait.mockRestore();
    }

    expect(h.prompts).toHaveLength(0);
    expect(h.errors).toEqual(["Your message wasn't sent: another run still holds this thread. Try again shortly."]);
    h.releaseOther();
    await other.consumeStream();
  });

  it('still reports the thread blocked to a signal sent straight to the agent', async () => {
    const h = await createHarness('blocked', durable);
    const other = await h.startOther();

    const result = h.sessionAgent.sendSignal(
      { type: 'user', contents: 'Are you there?' },
      { resourceId: h.session.identity.getResourceId(), threadId: h.session.thread.getId()! },
    );
    expect((await result.accepted).action).toBe('blocked');

    h.releaseOther();
    await other.consumeStream();
  });
});
