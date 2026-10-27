/**
 * A message's scopes are the scopes of the run it starts. A run's scopes are fixed
 * when it starts, so a message whose scopes differ from the run active on the thread
 * waits for that run to end and then starts its own run on the same thread; a message
 * with the same scopes, or with none, joins the active run as before.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { getRunAgentScopes } from '../../agent/scopes';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
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

/** Whether `promise` settles within `ms`. */
const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), ms))]);

/**
 * A session whose agent's first model call waits for `releaseFirst()`. Each model call
 * records its prompt and the scope tags its run holds.
 */
async function createHarness(id: string, durable: boolean) {
  const storage = new InMemoryStore();
  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const memory = new MockMemory({ storage });
  const calls: Array<{ prompt: string; tags: string[] }> = [];
  let releaseFirst!: () => void;
  const firstReleased = new Promise<void>(resolve => (releaseFirst = resolve));
  let runTags: string[] = [];

  const baseAgent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    // Resolved per run with the run's request context, so it sees the run's scope tags.
    instructions: ({ requestContext }) => {
      runTags = getRunAgentScopes(requestContext)
        .map(scope => scope.scope)
        .filter(tag => tag.startsWith('request:'));
      return 'You help.';
    },
    memory,
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        calls.push({ prompt: JSON.stringify(prompt), tags: runTags });
        if (calls.length === 1) await firstReleased;
        return { stream: reply('done') };
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
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });

  /** Start the first run with `scopes` and wait until its model call is in flight. */
  const startFirst = async (scopes?: string[]) => {
    const sent = session.sendMessage({ content: 'First task', ...(scopes ? { scopes } : {}) });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    return { sent };
  };

  return { session, calls, errors, releaseFirst, startFirst };
}

describe.each([false, true])('per-message scopes, durable=%s', durable => {
  it('waits for a run started with other scopes, then starts its own run with its own scopes', async () => {
    const h = await createHarness(`differ-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    const second = h.session.sendMessage({ content: 'Second task', scopes: ['request:r2'] });
    expect(await settlesWithin(second, 300)).toBe(false);
    expect(h.calls).toHaveLength(1);

    h.releaseFirst();
    await first;
    expect(await settlesWithin(second, 5_000)).toBe(true);

    expect(h.calls).toHaveLength(2);
    expect(h.calls[0]).toMatchObject({ tags: ['request:r1'] });
    expect(h.calls[0]!.prompt).not.toContain('Second task');
    expect(h.calls[1]).toMatchObject({ tags: ['request:r2'] });
    expect(h.calls[1]!.prompt).toContain('Second task');
    expect(h.errors).toEqual([]);
  });

  it('joins the active run when it names the same scopes', async () => {
    const h = await createHarness(`same-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    // Joining the active run is acknowledged while that run is still waiting on its model.
    expect(await settlesWithin(h.session.sendMessage({ content: 'More on it', scopes: ['request:r1'] }), 2_000)).toBe(
      true,
    );
    expect(h.calls).toHaveLength(1);

    h.releaseFirst();
    await first;
    await vi.waitFor(() => expect(h.calls.some(call => call.prompt.includes('More on it'))).toBe(true));
    expect(h.calls.every(call => call.tags.join() === 'request:r1')).toBe(true);
  });

  it('starts scoped messages sent during a run in the order they were sent', async () => {
    const h = await createHarness(`order-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    const second = h.session.sendMessage({ content: 'Task two', scopes: ['request:r2'] });
    const third = h.session.sendMessage({ content: 'Task three', scopes: ['request:r3'] });
    await new Promise(resolve => setTimeout(resolve, 200));
    h.releaseFirst();
    await first;
    expect(await settlesWithin(Promise.all([second, third]), 10_000)).toBe(true);

    expect(h.calls.map(call => call.tags.join())).toEqual(['request:r1', 'request:r2', 'request:r3']);
    expect(h.calls[1]!.prompt).toContain('Task two');
    expect(h.calls[1]!.prompt).not.toContain('Task three');
    expect(h.calls[2]!.prompt).toContain('Task three');
  });

  it('starts a queued message in its own run with its own scopes', async () => {
    const h = await createHarness(`queue-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    await h.session.queueMessage({ content: 'Queued task', scopes: ['request:r2'] });
    h.releaseFirst();
    await first;
    await vi.waitFor(() => expect(h.calls).toHaveLength(2), { timeout: 5_000 });

    expect(h.calls[1]).toMatchObject({ tags: ['request:r2'] });
    expect(h.calls[1]!.prompt).toContain('Queued task');
  });

  it('starts a queued signal in its own run with its own scopes', async () => {
    const h = await createHarness(`queue-signal-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    await h.session.queueSignal(
      { type: 'reactive', tagName: 'task', contents: 'Queued signal task' },
      { scopes: ['request:r2'] },
    );
    h.releaseFirst();
    await first;
    await vi.waitFor(() => expect(h.calls).toHaveLength(2), { timeout: 5_000 });

    expect(h.calls[1]).toMatchObject({ tags: ['request:r2'] });
    expect(h.calls[1]!.prompt).toContain('Queued signal task');
  });

  it('steers into a new run with the steering message scopes', async () => {
    const h = await createHarness(`steer-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    const steered = h.session.steer({ content: 'Change course', scopes: ['request:r2'] });
    h.releaseFirst();
    await first.catch(() => {});
    expect(await settlesWithin(steered, 5_000)).toBe(true);

    await vi.waitFor(() => expect(h.calls.some(c => c.prompt.includes('Change course'))).toBe(true), {
      timeout: 5_000,
    });
    const call = h.calls.find(c => c.prompt.includes('Change course'));
    expect(call).toMatchObject({ tags: ['request:r2'] });
  });

  it('delivers a scoped notification in its own run after a run started with other scopes', async () => {
    const h = await createHarness(`notify-${durable}`, durable);
    const { sent: first } = await h.startFirst(['request:r1']);

    await h.session.sendNotificationSignal(
      { source: 'test', kind: 'ping', priority: 'high', summary: 'Notified task' },
      { scopes: ['request:r2'] },
    );
    expect(h.calls).toHaveLength(1);
    h.releaseFirst();
    await first;
    await vi.waitFor(() => expect(h.calls.some(c => c.prompt.includes('notification-summary'))).toBe(true), {
      timeout: 5_000,
    });

    const call = h.calls.find(c => c.prompt.includes('notification-summary'));
    expect(call).toMatchObject({ tags: ['request:r2'] });
    expect(h.calls[0]!.prompt).not.toContain('notification-summary');
  });
});
