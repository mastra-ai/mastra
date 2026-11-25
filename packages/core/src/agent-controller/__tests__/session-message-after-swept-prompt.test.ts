/**
 * A session's run that parks on a prompt is dropped from memory once it has been
 * parked past `MASTRA_SUSPENDED_RUN_TTL_MS`, but the thread lease it held stays
 * until it expires. A message the user sends in that window is reported blocked
 * by the dropped run. It must wait for the lease to lapse and then run, not be
 * refused as if another agent's run were waiting on a prompt.
 *
 * The runtime reads both TTLs once at module load, so they are set in a hoisted
 * block before the module graph is imported.
 *
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

const { SUSPENDED_RUN_TTL_MS, LEASE_TTL_MS } = vi.hoisted(() => {
  const suspendedRunTtlMs = 300;
  const leaseTtlMs = 2_000;
  process.env.MASTRA_SUSPENDED_RUN_TTL_MS = String(suspendedRunTtlMs);
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(leaseTtlMs);
  process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = '100';
  return { SUSPENDED_RUN_TTL_MS: suspendedRunTtlMs, LEASE_TTL_MS: leaseTtlMs };
});
// Vitest reuses a worker process across test files, so restore the defaults for
// whichever file this worker picks up next.
afterAll(() => {
  delete process.env.MASTRA_SUSPENDED_RUN_TTL_MS;
  delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
  delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
});

vi.setConfig({ testTimeout: 30_000 });

const finish = (finishReason: string) => ({
  type: 'finish',
  finishReason,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
});

const reply = (text: string) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue(finish('stop'));
      controller.close();
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
      controller.enqueue(finish('tool-calls'));
      controller.close();
    },
  });

const requestAccess = createTool({
  id: 'request-access',
  description: 'Ask the user for access to a path.',
  inputSchema: z.object({ path: z.string() }),
  execute: async (_input, context) => {
    if (context?.agent?.resumeData !== undefined) return `access: ${context.agent.resumeData}`;
    await context?.agent?.suspend?.({ kind: 'access_request' });
    return 'unreachable';
  },
});

/** Whether `promise` settles within `ms`. */
const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms))]);

/** A session whose first message parks on a prompt; later messages get a reply. */
async function createHarness(id: string, durable: boolean) {
  const storage = new InMemoryStore();
  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const memory = new MockMemory({ storage });
  const prompts: string[] = [];

  const baseAgent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You help.',
    memory,
    tools: { requestAccess },
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return { stream: prompts.length === 1 ? askForAccess() : reply('here') };
      },
    }),
  });
  const agent = durable ? createDurableAgent({ agent: baseAgent, cache, pubsub }) : baseAgent;
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent as any }, logger: false, storage, cache, pubsub });
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

  const errors: string[] = [];
  const ends: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
    if (event.type === 'agent_end') ends.push(event.reason ?? '');
  });
  /** Run the agent on another thread; registering that run sweeps parked runs past their TTL. */
  const runElsewhere = async () => {
    const output = await registeredAgent.stream('Elsewhere', {
      memory: { thread: `${id}-elsewhere`, resource: session.identity.getResourceId() },
    });
    for await (const _ of output.fullStream) void _;
  };
  return { session, prompts, errors, ends, runElsewhere, agent: registeredAgent };
}

describe.each([false, true])('a message after the session’s parked run is dropped from memory, durable=%s', durable => {
  it('waits for the dropped run’s lease to lapse, then runs', async () => {
    const h = await createHarness(`swept-${durable}`, durable);
    await h.session.sendMessage({ content: 'Read /x' });
    expect(h.prompts).toHaveLength(1);

    await new Promise(resolve => setTimeout(resolve, SUSPENDED_RUN_TTL_MS + 100));
    await h.runElsewhere();

    expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), LEASE_TTL_MS * 3)).toBe(true);
    expect({ errors: h.errors, prompts: h.prompts.length }).toEqual({ errors: [], prompts: 3 });
  });

  // A durable run's stream stays open while it is parked, so the session's
  // subscriber must stop reading it once the run is dropped.
  it('runs a message sent after the lease has lapsed to the end', async () => {
    const h = await createHarness(`swept-lapsed-${durable}`, durable);
    await h.session.sendMessage({ content: 'Read /x' });
    expect(h.ends).toEqual(['suspended']);

    await new Promise(resolve => setTimeout(resolve, SUSPENDED_RUN_TTL_MS + 100));
    await h.runElsewhere();
    await new Promise(resolve => setTimeout(resolve, LEASE_TTL_MS + 500));

    expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), 5_000)).toBe(true);
    expect({ errors: h.errors, prompts: h.prompts.length, ends: h.ends }).toEqual({
      errors: [],
      prompts: 3,
      ends: ['suspended', 'complete'],
    });
  });

  // A subscriber that queued the parked run but starts reading only after the
  // sweep must skip the dropped run, not wait on its open stream.
  it('moves a subscriber that first reads after the sweep on to the next run', async () => {
    const h = await createHarness(`swept-lazy-${durable}`, durable);
    await h.session.sendMessage({ content: 'Read /x' });
    expect(h.ends).toEqual(['suspended']);
    const subscription = await h.agent.subscribeToThread({
      resourceId: h.session.identity.getResourceId(),
      threadId: h.session.thread.getId()!,
    });

    try {
      await new Promise(resolve => setTimeout(resolve, SUSPENDED_RUN_TTL_MS + 100));
      await h.runElsewhere();
      await new Promise(resolve => setTimeout(resolve, LEASE_TTL_MS + 500));
      expect(await settlesWithin(h.session.sendMessage({ content: 'Are you there?' }), 5_000)).toBe(true);

      // The parked run never finishes with `stop`; the next run does.
      const reachesNextRun = (async () => {
        for await (const part of subscription.stream as AsyncIterable<any>) {
          if (part?.type === 'finish' && part.payload?.stepResult?.reason === 'stop') return true;
        }
        return false;
      })();
      expect(await settlesWithin(reachesNextRun, 3_000)).toBe(true);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('still takes the answer to the dropped prompt', async () => {
    const h = await createHarness(`swept-answer-${durable}`, durable);
    await h.session.sendMessage({ content: 'Read /x' });
    expect(h.ends).toEqual(['suspended']);

    await new Promise(resolve => setTimeout(resolve, SUSPENDED_RUN_TTL_MS + 100));
    await h.runElsewhere();
    await new Promise(resolve => setTimeout(resolve, LEASE_TTL_MS + 500));

    expect(await settlesWithin(h.session.respondToToolSuspension({ resumeData: 'granted' }), 5_000)).toBe(true);
    await vi.waitFor(() => expect(h.ends).toEqual(['suspended', 'complete']), { timeout: 5_000 });
    expect({ errors: h.errors, prompts: h.prompts.length }).toEqual({ errors: [], prompts: 3 });
  });
});
