/**
 * RunScope leak vectors for the agentic loop under the real engine.
 *
 * `agentic-loop-snapshot-lifecycle.test.ts` proves that one run, taken
 * through each terminal mode, releases its scope correctly. This suite
 * covers the leak shapes a single-run test cannot see:
 *
 * 1. Many parallel runs in flight against the same Mastra — scopes must
 *    not bleed between runIds and every one must release on completion.
 * 2. Many sequential runs back-to-back — the scope map must not grow.
 * 3. Abandoned suspended run — when a suspend never resumes, the TTL
 *    sweep must eventually evict both the workflow registration and the
 *    scope.
 */
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function makeReplyModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('agentic-loop RunScope leak vectors', () => {
  it('isolates scopes across parallel runs and releases all of them on completion', async () => {
    const agent = new Agent({
      id: 'parallel-agent',
      name: 'Parallel Agent',
      instructions: 'You answer.',
      model: makeReplyModel('hello'),
    });
    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const N = 8;
    const streams = await Promise.all(Array.from({ length: N }, (_, i) => agent.stream(`req-${i}`)));

    // Every run must have a distinct runId — sanity check the harness.
    const runIds = streams.map(s => s.runId);
    expect(new Set(runIds).size).toBe(N);

    // Sample mid-flight: at least one scope must currently be live, otherwise
    // the after-drain "all released" assertion below would pass vacuously
    // (e.g. if __createRunScope ever silently became a no-op).
    const liveBeforeDrain = runIds.filter(id => mastra.__getRunScope(id) !== undefined).length;
    expect(liveBeforeDrain).toBeGreaterThan(0);

    // Drain every stream concurrently to exercise overlapping in-flight runs.
    await Promise.all(
      streams.map(async s => {
        for await (const _chunk of s.fullStream) {
          // consume
        }
      }),
    );

    // Every scope released — proves refcounted register/unregister fires
    // per-run with no cross-run interference.
    for (const runId of runIds) {
      expect(mastra.__getRunScope(runId)).toBeUndefined();
    }
  }, 30000);

  it('does not accumulate scopes across many sequential runs', async () => {
    const agent = new Agent({
      id: 'sequential-agent',
      name: 'Sequential Agent',
      instructions: 'You answer.',
      model: makeReplyModel('ok'),
    });
    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const runIds: string[] = [];
    let sawLiveScopeDuringRun = false;
    for (let i = 0; i < 20; i++) {
      const s = await agent.stream(`seq-${i}`);
      runIds.push(s.runId);
      for await (const chunk of s.fullStream) {
        // Sample once per run: the scope must be live while the stream is
        // being drained, otherwise the after-loop "all released" assertion
        // would pass vacuously (e.g. if scope creation silently became a
        // no-op).
        if (!sawLiveScopeDuringRun && mastra.__getRunScope(s.runId) !== undefined) {
          sawLiveScopeDuringRun = true;
        }
        void chunk;
      }
    }
    expect(sawLiveScopeDuringRun).toBe(true);

    // After the sequence, every run's scope must be released — if any one
    // leaked we would see it here regardless of which run.
    for (const runId of runIds) {
      expect(mastra.__getRunScope(runId)).toBeUndefined();
    }
  }, 30000);

  it('evicts the scope when the TTL sweep collects an abandoned suspended run', async () => {
    // Build a model that emits a tool-call so the run suspends on approval
    // and never resumes. The scope is held alive across the suspend boundary;
    // a TTL-expired registration must eventually drop both the registration
    // and the scope.
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'abandon-1',
                toolName: 'echoTool',
                input: '{}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        // Never reached — the run is abandoned at suspend.
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([]),
        };
      },
    });

    const { createTool } = await import('../../tools');
    const { z } = await import('zod/v4');
    const echoTool = createTool({
      id: 'echoTool',
      description: 'echo',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async () => ({ ok: true }),
    });
    const agent = new Agent({
      id: 'abandon-agent',
      name: 'Abandon Agent',
      instructions: 'You echo.',
      model,
      tools: { echoTool },
    });
    const mastra = new Mastra({
      agents: { agent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const stream = await agent.stream('please', { requireToolApproval: true });
    let approvalSeen = false;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') approvalSeen = true;
    }
    expect(approvalSeen).toBe(true);

    // After suspend the scope stays alive in-process across the suspend
    // boundary — the loop workflow registration is still live. The TTL
    // sweep is what eventually evicts the abandoned registration.
    expect(mastra.__getRunScope(stream.runId)).toBeDefined();

    // Advance virtual time past the TTL using fake timers so the sweep
    // sees the abandoned registration as stale.
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });
    vi.setSystemTime(Date.now() + Mastra.INTERNAL_WORKFLOW_TTL_MS + 1);

    try {
      // Fire any new registration to trigger the sweep (it runs on every
      // new run-scoped registration). Use a real createWorkflow probe so
      // the registration path runs end-to-end.
      const { createWorkflow, createStep } = await import('../../workflows');
      const probeStep = createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      });
      const probe = createWorkflow({
        id: 'sweep-probe',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        steps: [probeStep],
      })
        .then(probeStep)
        .commit();
      mastra.__registerInternalWorkflow(probe, 'sweep-probe-runid');
      mastra.__unregisterInternalWorkflow('sweep-probe', 'sweep-probe-runid');
    } finally {
      vi.useRealTimers();
    }

    // The abandoned run's scope must now be gone — the TTL sweep evicted
    // both the workflow registration and the matching scope.
    expect(mastra.__getRunScope(stream.runId)).toBeUndefined();
  }, 30000);
});
