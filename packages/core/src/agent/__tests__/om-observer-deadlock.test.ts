/**
 * Regression test for the Observational Memory (OM) observer deadlock.
 *
 * Bug: When an OM internal agent (observer/reflector) inherits the parent run's
 * RequestContext (which carries a threadId), calling `waitForCrossAgentThreadRun`
 * would detect the parent run as "active" on that thread and wait for it to finish.
 * The parent run was itself blocked waiting for the OM observation to complete,
 * creating a circular dependency that hangs forever.
 *
 * Fix: Skip `waitForCrossAgentThreadRun` when the calling agent is one of the
 * known OM internal agents (observational-memory-observer, multi-thread-observer,
 * observational-memory-reflector).
 *
 * @see https://github.com/mastra-ai/mastra/issues/17827
 */

import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]),
    }),
  });
}

describe('OM observer deadlock fix', () => {
  const OM_INTERNAL_AGENT_IDS = [
    'observational-memory-observer',
    'multi-thread-observer',
    'observational-memory-reflector',
  ] as const;

  it.each(OM_INTERNAL_AGENT_IDS)(
    'waitForCrossAgentThreadRun returns immediately for OM internal agent "%s"',
    async agentId => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();

      const mainAgent = new Agent({
        id: 'main-agent',
        name: 'Main Agent',
        instructions: 'Test',
        model: createTextModel('main response'),
      });

      const omAgent = new Agent({
        id: agentId,
        name: agentId,
        instructions: 'OM internal',
        model: createTextModel('observation'),
      });

      // Simulate a blocking main run registered on the thread.
      let resolveMainRun!: () => void;
      const mainRunOutput = {
        runId: 'main-run-1',
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId: 'main-run-1', payload: { text: 'hello' } };
        })(),
        _waitUntilFinished: () => new Promise<void>(resolve => (resolveMainRun = resolve)),
      } as any;

      runtime.registerRun(
        mainAgent,
        mainRunOutput,
        { runId: 'main-run-1', memory: { resource: 'test-resource', thread: 'test-thread' } } as any,
        pubsub,
      );

      // The OM internal agent attempts to call waitForCrossAgentThreadRun on the
      // same thread. Without the fix this would deadlock forever because the main
      // run is waiting for OM and OM is waiting for the main run.
      const waitStart = Date.now();
      await runtime.waitForCrossAgentThreadRun(
        omAgent,
        { memory: { resource: 'test-resource', thread: 'test-thread' } },
        pubsub,
      );
      const elapsed = Date.now() - waitStart;

      // Should return immediately without waiting for the main run to finish.
      expect(elapsed).toBeLessThan(200);

      // Clean up: resolve the "main run" so the runtime doesn't keep dangling handles.
      resolveMainRun();
    },
  );

  it('waitForCrossAgentThreadRun still waits for non-OM agents', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    const ownerAgent = new Agent({
      id: 'owner-agent',
      name: 'Owner',
      instructions: 'Test',
      model: createTextModel('owner response'),
    });

    const otherAgent = new Agent({
      id: 'other-agent',
      name: 'Other',
      instructions: 'Test',
      model: createTextModel('other response'),
    });

    let resolveRun!: () => void;
    const output = {
      runId: 'owner-run-1',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => new Promise<void>(resolve => (resolveRun = resolve)),
    } as any;

    runtime.registerRun(
      ownerAgent,
      output,
      { runId: 'owner-run-1', memory: { resource: 'r', thread: 't' } } as any,
      pubsub,
    );

    let resolved = false;
    const waitPromise = runtime
      .waitForCrossAgentThreadRun(otherAgent, { memory: { resource: 'r', thread: 't' } }, pubsub)
      .then(() => {
        resolved = true;
      });

    // Wait a tick — should still be blocking.
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);

    resolveRun();
    await waitPromise;
    expect(resolved).toBe(true);
  });
});
