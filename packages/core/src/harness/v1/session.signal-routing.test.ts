/**
 * Harness v1 — `Session.message()` signal routing.
 *
 * Slice A wired `message()` through `agent.sendSignal()` instead of calling
 * `agent.stream()` directly. These tests pin the observable contract:
 *
 *   - on an idle thread, `sendSignal` returns a `runId` that matches the
 *     output the runtime registers for the run that gets started,
 *   - the agent's `stream()` is invoked with the runtime-allocated `runId`
 *     and a `CreatedAgentSignal` (not the raw caller content),
 *   - `Session.message()` resolves with that same `runId` on the returned
 *     `AgentResult`,
 *   - the structured-output + `sync: true` path still bypasses signals and
 *     hits `agent.generate()` directly.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import type { HarnessEvent } from './events';

async function waitForStreamCalls(agent: MockAgent, expected: number): Promise<void> {
  for (let i = 0; i < 100 && agent.streamCalls.length < expected; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

describe('Session.message() signal routing', () => {
  it('routes default-path messages through agent.sendSignal and stamps the runtime runId on the result', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const result = await session.message({ content: 'hi' });

    // Agent saw exactly one stream() call.
    expect(agent.streamCalls).toHaveLength(1);
    const call = agent.streamCalls[0]!;
    expect(call.type).toBe('stream');

    // The first arg is a CreatedAgentSignal wrapping the caller prompt,
    // not the raw string.
    const messages = call.messages as { __isCreatedSignal?: boolean; type?: string; contents?: unknown };
    expect(messages.__isCreatedSignal).toBe(true);
    expect(messages.type).toBe('user-message');
    expect(messages.contents).toBe('hi');

    // The options carry the runtime-allocated runId; the result mirrors it.
    const options = call.options as { runId?: string; memory?: { thread?: string; resource?: string } };
    expect(typeof options.runId).toBe('string');
    expect(options.runId).toBe(result.runId);

    // Thread + resource were threaded through memory so the runtime can key
    // the run on the right thread.
    expect(options.memory?.resource).toBe('u1');
    expect(options.memory?.thread).toBe(session.threadId);
  });

  it('reuses the same agent instance for two sequential messages on one session', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const a = await session.message({ content: 'one' });
    const b = await session.message({ content: 'two' });

    // Two distinct runs, two distinct runIds.
    expect(agent.streamCalls).toHaveLength(2);
    expect(a.runId).not.toBe(b.runId);
    expect((agent.streamCalls[0]!.options as { runId: string }).runId).toBe(a.runId);
    expect((agent.streamCalls[1]!.options as { runId: string }).runId).toBe(b.runId);
  });

  it('does not take turn ownership when a message drains into an active run', async () => {
    const { harness, agent } = setupHarness();
    let releaseFirst!: () => void;
    const hold = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    agent.enqueueRun({ holdUntil: hold, text: 'first' });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);
    for (let i = 0; i < 5; i++) await new Promise<void>(resolve => setImmediate(resolve));
    expect(session.isRunning()).toBe(true);

    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    const second = session.message({ content: 'second' });
    await Promise.resolve();
    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(0);

    releaseFirst();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(secondResult.runId).toBe(firstResult.runId);
    expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('rejects requestContext on messages that drain into an active run', async () => {
    const { harness, agent } = setupHarness();
    let releaseFirst!: () => void;
    const hold = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    agent.enqueueRun({ holdUntil: hold, text: 'first' });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    await expect(session.message({ content: 'second', requestContext: new Map() as any })).rejects.toThrow(
      /requestContext/,
    );

    releaseFirst();
    await first;
  });

  it('does not route the structured + sync path through signals', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ object: { answer: '42' } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const out = await session.message({
      content: 'compute',
      output: z.object({ answer: z.string() }),
      sync: true,
    });

    expect(out).toEqual({ answer: '42' });

    // Structured + sync still uses agent.generate() — the agent did not see
    // a stream() call at all.
    expect(agent.streamCalls.some(c => c.type === 'stream')).toBe(false);
    expect(agent.streamCalls.some(c => c.type === 'generate')).toBe(true);
  });
});
