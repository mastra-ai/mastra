/**
 * A worker pool finalizes runs it never prepared: the API replica starts each run, and a worker
 * holding only a rebuilt run-registry entry ends the root spans. The outcome has to survive that
 * handoff. With this transport a run stays on the worker that picked it up, so this pins the
 * handoff on every member of the pool; the Inngest pool test covers steps that split across
 * workers mid-run.
 */
import { randomUUID } from 'node:crypto';

import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createSpanOutcomeAgent, createSpanOutcomeObservability } from './fixtures/span-outcome-agent';
import type { SpanOutcomePeerArgs } from './fixtures/span-outcome-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';

const WORKER = new URL('./fixtures/span-outcome-peer.ts', import.meta.url);
const TRIPWIRE = { reason: 'Deploy preflight rejected this request', processorId: 'deploy-preflight' };
/** Runs spread over the pool round-robin, so each case repeats until every worker has taken one. */
const REPEATS = 3;

interface RunCase {
  name: string;
  maxSteps?: number;
  blocked?: boolean;
  expected: { outcome: string; stopReason: string | null; stopReasonContext?: Record<string, unknown> };
}

const CASES: RunCase[] = [
  { name: 'normal completion', expected: { outcome: 'success', stopReason: null } },
  {
    name: 'step limit',
    maxSteps: 1,
    expected: { outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { maxSteps: 1 } },
  },
  {
    name: 'input guardrail',
    blocked: true,
    expected: { outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { processorId: TRIPWIRE.processorId } },
  },
];

async function guarded<T>(promise: Promise<T>, context: () => string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Worker run did not settle\n${context()}`)), DEFAULT_HANG_GUARD_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('span outcomes recorded by a worker pool', () => {
  it(
    'ends AGENT_RUN and MODEL_GENERATION with the real outcome for completion, step limit and guardrail',
    async () => {
      const env = await createXprocEnv({ workers: false });
      const agentId = `span-outcome-${randomUUID()}`;
      const { agent, modelCalls } = createSpanOutcomeAgent(agentId, TRIPWIRE);
      const runner = createEventedAgent({ agent });
      const storage = new LibSQLStore({ id: 'span-outcome-api', url: env.dbUrl });
      const mastra = new Mastra({
        agents: { [agentId]: runner },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        workers: false,
        observability: createSpanOutcomeObservability(),
      });
      try {
        const args = { agentId, tripwire: TRIPWIRE } satisfies SpanOutcomePeerArgs;
        const workers = await Promise.all(
          ['worker-a', 'worker-b', 'worker-c'].map(role => env.spawnPeer(WORKER, args, { role, workers: true })),
        );
        await Promise.all(workers.map(worker => worker.waitFor('worker-ready')));
        const observability = await storage.getStore('observability');

        for (const run of CASES) {
          for (let attempt = 0; attempt < REPEATS; attempt++) {
            const label = `${run.name} #${attempt}`;
            const runId = `span-outcome-${randomUUID()}`;
            const result = await runner.stream('Run the step', {
              runId,
              maxSteps: run.maxSteps,
              requestContext: new RequestContext([['blocked', run.blocked ?? false]]),
            });
            await guarded(
              (async () => {
                for await (const _chunk of result.fullStream) {
                  // Consume through the finish event; a worker ends the spans after it.
                }
              })(),
              () => `${label}\n${env.describe()}`,
            );
            // Only the workers call the model. Without this control the span assertions
            // below would also pass for a loop that ran in this process.
            expect(modelCalls(), label).toBe(0);

            const root = await vi.waitFor(
              async () => {
                const { spans } = await observability!.listTraces({ pagination: { page: 0, perPage: 50 } });
                const ended = spans.find(span => span.metadata?.runId === runId && span.endedAt);
                expect(ended, `${label}: a worker ended AGENT_RUN`).toBeDefined();
                return ended!;
              },
              { timeout: DEFAULT_HANG_GUARD_MS, interval: 100 },
            );
            const trace = await observability!.getTrace({ traceId: root.traceId });
            const generation = trace!.spans.find(span => span.spanType === 'model_generation');

            const outcomeOf = (span: { outcome?: unknown; stopReason?: unknown; stopReasonContext?: unknown }) => ({
              outcome: span.outcome,
              stopReason: span.stopReason ?? null,
              ...(run.expected.stopReasonContext ? { stopReasonContext: span.stopReasonContext } : {}),
            });
            expect.soft(outcomeOf(root), `${label}: AGENT_RUN`).toEqual(run.expected);
            expect.soft(outcomeOf(generation!), `${label}: MODEL_GENERATION`).toEqual(run.expected);
          }
        }

        for (const worker of workers) worker.send('finish');
        await Promise.all(workers.map(worker => worker.result()));
        for (const worker of workers) expect(await worker.exit()).toEqual({ code: 0, signal: null });
      } finally {
        await mastra.shutdown();
        await storage.close();
        await env.cleanup();
      }
    },
    PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS * CASES.length * REPEATS + 10_000,
  );
});
