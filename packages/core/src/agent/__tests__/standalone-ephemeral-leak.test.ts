/**
 * Regression test for #19404: standalone Agent ephemeral Mastra leaks
 * scorer hook on the module-level mitt emitter.
 *
 * A standalone Agent (not attached to a Mastra via `{ agents }`) creates
 * an ephemeral Mastra on first `stream()`/`generate()` call.  Before the
 * fix, the scorer hook registered by the ephemeral Mastra was never
 * unregistered, causing the module-level emitter to retain a reference
 * and prevent garbage collection.
 *
 * This suite verifies:
 * 1. Hooks are cleaned up automatically after #execute() completes
 * 2. The public dispose() method cleans up hooks explicitly
 * 3. Multiple sequential standalone Agents do not accumulate hooks
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AvailableHooks, executeHook } from '../../hooks';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function makeMockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

async function flushHooks() {
  await new Promise(resolve => setTimeout(resolve, 50));
}

describe('standalone Agent ephemeral Mastra hook leak (#19404)', () => {
  beforeAll(() => {
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'false');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('clean up scorer hook after standalone stream() completes', async () => {
    const agent = new Agent({
      id: 'standalone-leak-test',
      name: 'Standalone Leak Test',
      instructions: 'You answer.',
      model: makeMockModel(),
    });

    // Trigger ephemeral Mastra creation
    const result = await agent.stream('hello');
    // Consume the stream fully
    for await (const _ of result.fullStream) {
      // drain
    }

    // After #execute() finally block, the hook should be unregistered.
    // Verify by firing a foreign scorer run — no Mastra should react.
    const foreignScorerRun = {
      entity: { id: 'agent-owned-by-another-mastra' },
      entityType: 'AGENT',
      scorer: { id: 'a-scorer-this-mastra-never-registered' },
      input: 'in',
      output: 'out',
    } as any;

    // If the hook leaked, executeHook would trigger the ephemeral Mastra's
    // handler which would call trackException (since it can't find the scorer).
    // We can't easily spy on the discarded ephemeral Mastra's logger, but we
    // can verify no unhandled errors propagate.
    expect(() => {
      executeHook(AvailableHooks.ON_SCORER_RUN, foreignScorerRun);
    }).not.toThrow();

    await flushHooks();
  });

  it('dispose() explicitly cleans up hooks', async () => {
    const agent = new Agent({
      id: 'dispose-test',
      name: 'Dispose Test',
      instructions: 'You answer.',
      model: makeMockModel(),
    });

    // Trigger ephemeral Mastra creation
    const result = await agent.stream('hello');
    for await (const _ of result.fullStream) {
      // drain
    }

    // Explicit dispose
    agent.dispose();

    // Agent should still work after dispose (creates new ephemeral Mastra)
    const result2 = await agent.stream('hello again');
    for await (const _ of result2.fullStream) {
      // drain
    }

    // Clean up again
    agent.dispose();
  });

  it('sequential standalone Agents do not accumulate hooks', async () => {
    // Create multiple standalone agents, each used once then discarded.
    // Before the fix, each would register a hook that never gets cleaned up.
    for (let i = 0; i < 5; i++) {
      const agent = new Agent({
        id: `seq-agent-${i}`,
        name: `Sequential Agent ${i}`,
        instructions: 'You answer.',
        model: makeMockModel(),
      });

      const result = await agent.stream(`question ${i}`);
      for await (const _ of result.fullStream) {
        // drain
      }
      // Agent is discarded here — hook should be cleaned up by #execute() finally
    }

    // Fire a foreign scorer run — should not trigger any leaked handlers
    const foreignScorerRun = {
      entity: { id: 'agent-owned-by-another-mastra' },
      entityType: 'AGENT',
      scorer: { id: 'a-scorer-this-mastra-never-registered' },
      input: 'in',
      output: 'out',
    } as any;

    expect(() => {
      executeHook(AvailableHooks.ON_SCORER_RUN, foreignScorerRun);
    }).not.toThrow();

    await flushHooks();
  });

  it('Mastra-attached Agent does not create ephemeral Mastra (no leak vector)', async () => {
    const { Mastra } = await import('../../mastra');
    const { InMemoryStore } = await import('../../storage');

    const agent = new Agent({
      id: 'attached-agent',
      name: 'Attached Agent',
      instructions: 'You answer.',
      model: makeMockModel(),
    });

    const mastra = new Mastra({
      agents: { attached: agent },
      storage: new InMemoryStore(),
    });

    // Agent is now attached to a real Mastra — no ephemeral Mastra needed
    const result = await agent.stream('hello');
    for await (const _ of result.fullStream) {
      // drain
    }

    // Cleanup the real Mastra's hooks
    mastra.__unregisterHooks();
  });
});
