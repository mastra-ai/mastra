import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

/** A run output whose parts and end the test drives, as an agent's stream would. */
function controlledOutput(runId: string) {
  let controller!: ReadableStreamDefaultController<any>;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  const output = {
    runId,
    status: 'running',
    fullStream: new ReadableStream({
      start(c) {
        controller = c;
      },
    }),
    _waitUntilFinished: () => finished,
  } as any;
  return {
    output,
    push: (part: any) => controller.enqueue(part),
    end: (status: 'success' | 'suspended' = 'success') => {
      output.status = status;
      controller.close();
      finish();
    },
  };
}

const agent = { id: 'generation-agent', getMemory: async () => undefined } as unknown as Agent<any, any, any, any>;
const options = { memory: { thread: 'generation-thread', resource: 'generation-user' } } as any;
const text = (t: string) => ({ type: 'text-delta', payload: { id: 't', text: t } });
const start = { type: 'start', payload: {} };
const finish = { type: 'finish', payload: {} };
const summarize = (parts: any[]) =>
  parts.map(part => (part.type === 'text-delta' ? `text:${part.payload.text}` : part.type));

/** Three processes on one bus: two that drive the run in turn, and one whose subscriber reads the thread. */
async function setup({ read: startReading = true } = {}) {
  const pubsub = new LeasePubSub();
  const original = new AgentThreadStreamRuntime();
  const recovering = new AgentThreadStreamRuntime();
  const observer = new AgentThreadStreamRuntime();
  const subscription = await observer.subscribeToThread(
    agent,
    { threadId: 'generation-thread', resourceId: 'generation-user' },
    pubsub,
  );
  const read: any[] = [];
  const startReader = () =>
    void (async () => {
      for await (const part of subscription.stream) read.push(part);
    })();
  if (startReading) startReader();
  return { pubsub, original, recovering, subscription, read, startReader };
}

describe('thread stream: runs taken over by a later claim generation', () => {
  it('ends the superseded execution for thread readers and drops what it still forwards', async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-before-takeover '));
    await nextTicks(10);

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B1 '));
    // The original caller's stream follows the run across the takeover, so its process re-broadcasts B's output.
    a.push(text('B1 '));
    b.push(text('B2'));
    a.push(text('B2'));
    b.push(finish);
    a.push(finish);
    b.end();
    a.end();

    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    await nextTicks(20);
    expect(summarize(read)).toEqual(['start', 'text:A-before-takeover ', 'start', 'text:B1 ', 'text:B2', 'finish']);
    subscription.unsubscribe();
  });

  it('moves thread readers on to the recovered execution when the original process died mid-run', async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-partial '));
    await nextTicks(10);
    // The original process dies here: its output never ends.

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B-answer'));
    b.push(finish);
    b.end();

    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    expect(summarize(read)).toEqual(['start', 'text:A-partial ', 'start', 'text:B-answer', 'finish']);
    subscription.unsubscribe();
  });

  it("ignores a registration and parts from an older generation that arrive after a recovery's", async () => {
    const { pubsub, original, recovering, subscription, read } = await setup();

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { strict: true, generation: 2 });
    b.push(start);
    b.push(text('B-answer'));
    b.push(finish);
    b.end();
    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('stale'));
    a.push(finish);
    a.end();
    await nextTicks(30);

    expect(summarize(read)).toEqual(['start', 'text:B-answer', 'finish']);
    subscription.unsubscribe();
  });

  it('keeps a suspended half readable when another process resumes the run under a later generation', async () => {
    // The reader starts only after the resume registers, so the suspended half is still unread.
    const { pubsub, original, recovering, subscription, read, startReader } = await setup({ read: false });

    const a = controlledOutput('run-1');
    await original.registerRun(agent, a.output, options, pubsub, { generation: 1 });
    a.push(start);
    a.push(text('A-before-suspend'));
    a.end('suspended');
    await nextTicks(10);

    const b = controlledOutput('run-1');
    await recovering.registerRun(agent, b.output, options, pubsub, { generation: 2 });
    b.push(start);
    b.push(text('B-resumed'));
    b.push(finish);
    b.end();
    await nextTicks(10);

    startReader();
    await vi.waitFor(() => expect(read.some(part => part.type === 'finish')).toBe(true));
    expect(summarize(read)).toEqual(['start', 'text:A-before-suspend', 'start', 'text:B-resumed', 'finish']);
    subscription.unsubscribe();
  });
});
