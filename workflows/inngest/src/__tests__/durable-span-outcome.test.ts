/**
 * Two connect workers form a pool; the Inngest dev server routes each step execution to one of
 * them, so the step that decides the loop is over and the step that ends the run's root spans can
 * land on different processes. The outcome must then reach the final step through the persisted
 * iteration state: the deciding worker's run-registry entry is not there to read.
 */
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import { DefaultStorage } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { INNGEST_PORT, startConnectInngestDevServer, stopInngestDevServer } from './durable-agent.test.utils';
import { buildSpanOutcomeAgent, SPAN_OUTCOME_TRIPWIRE } from './fixtures/span-outcome-agent';

vi.setConfig({ testTimeout: 240_000, hookTimeout: 120_000 });

const agentId = `span-outcome-${randomUUID()}`;
const dbUrl = pathToFileURL(path.join(tmpdir(), `mastra-span-outcome-${Date.now()}.db`)).href;
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'span-outcome-worker.ts');
const readerStorage = new DefaultStorage({ id: 'span-outcome-reader', url: dbUrl });
/** Which worker gets each step execution is up to the dev server, so each case runs a few times. */
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
    expected: {
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: { processorId: SPAN_OUTCOME_TRIPWIRE.processorId },
    },
  },
];

let workers: ChildProcess[] = [];
let devServer: ChildProcess | null = null;

async function terminateWorker(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null) return;
  const exited = new Promise<void>(resolve => proc.once('exit', () => resolve()));
  proc.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>(resolve => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!stopped && proc.exitCode === null) {
    proc.kill('SIGKILL');
    await exited;
  }
}

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', workerPath, dbUrl, agentId, String(INNGEST_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, INNGEST_DEV: '1', INNGEST_BASE_URL: `http://localhost:${INNGEST_PORT}` },
    });
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminateWorker(proc).then(() => reject(error), reject);
    };
    const onData = (buffer: Buffer) => {
      if (!settled && buffer.toString().includes('[worker] ready')) {
        settled = true;
        clearTimeout(timer);
        resolve(proc);
      }
    };
    const timer = setTimeout(() => fail(new Error('span-outcome worker did not become ready')), 90_000);
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.once('error', error => fail(error));
    proc.once('exit', code => fail(new Error(`span-outcome worker exited early with code ${code}`)));
  });
}

describe('span outcomes recorded by a connect worker pool', () => {
  beforeAll(async () => {
    devServer = await startConnectInngestDevServer();
    workers = await Promise.all([startWorker(), startWorker()]);
    await new Promise(resolve => setTimeout(resolve, 3000)); // let Inngest register the workers' functions
  });

  afterAll(async () => {
    await Promise.all(workers.map(terminateWorker));
    await stopInngestDevServer(devServer);
    devServer = null;
  });

  it('ends AGENT_RUN and MODEL_GENERATION with the real outcome for completion, step limit and guardrail', async () => {
    const { durableAgent } = buildSpanOutcomeAgent({ dbUrl, agentId, inngestPort: INNGEST_PORT });
    const observability = await readerStorage.getStore('observability');

    for (const run of CASES) {
      for (let attempt = 0; attempt < REPEATS; attempt++) {
        const label = `${run.name} #${attempt}`;
        const result = await durableAgent.stream([{ role: 'user', content: 'Run the step' }], {
          maxSteps: run.maxSteps,
          requestContext: new RequestContext([['blocked', run.blocked ?? false]]),
        });
        try {
          for await (const _chunk of result.output.fullStream) {
            // Consume through the finish event; a worker ends the spans after it.
          }
        } finally {
          result.cleanup?.();
        }

        const root = await vi.waitFor(
          async () => {
            const { spans } = await observability!.listTraces({ pagination: { page: 0, perPage: 50 } });
            const ended = spans.find(span => span.metadata?.runId === result.runId && span.endedAt);
            expect(ended, `${label}: a worker ended AGENT_RUN`).toBeDefined();
            return ended!;
          },
          { timeout: 30_000, interval: 250 },
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
  });
});
