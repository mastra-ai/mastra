/**
 * Ported from validation harness case T10 (inngest).
 * The kill-* variants drop the analyst's HTTP request in the same process, not
 * SIGKILL. Ordinary tool throws become tool results, not Inngest function retries.
 * Completed delegations are memoized; the delegation in flight is at-least-once:
 * its original attempt can commit even after the supervisor run has failed.
 * This tests transport retry and delegation memoization, not process-death recovery.
 */
import { randomUUID } from 'node:crypto';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { Agent } from '@mastra/core/agent';
import {
  MastraLanguageModelV2Mock as MockLanguageModelV2,
  simulateReadableStream,
} from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createInngestAgent, isInngestAgent } from '../index';
import {
  HANDLER_PORT,
  INNGEST_PORT,
  dropSharedHandlerConnections,
  generateTestId,
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  stopSharedInngestDevServer,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

const ALPHA = 'alpha-729';
const OMEGA = 'omega-483';
const LOOP_EVENT = 'workflow.inngest:durable-agentic-loop';
const triggerSchema = z.object({
  name: z.literal(LOOP_EVENT),
  data: z.object({ runId: z.string(), inputData: z.object({ agentId: z.string() }) }),
});
const runsSchema = z.object({
  data: z.object({
    runs: z.object({
      edges: z.array(
        z.object({ node: z.object({ id: z.string(), status: z.string(), triggerIDs: z.array(z.string()) }) }),
      ),
    }),
  }),
});

function response(toolName?: string, input: object = {}, text = '') {
  const chunks: LanguageModelV2StreamPart[] = [{ type: 'stream-start', warnings: [] }];
  if (toolName) {
    chunks.push({ type: 'tool-call', toolCallId: randomUUID(), toolName, input: JSON.stringify(input) });
  } else {
    chunks.push(
      { type: 'text-start', id: 'answer' },
      { type: 'text-delta', id: 'answer', delta: text },
      { type: 'text-end', id: 'answer' },
    );
  }
  chunks.push({
    type: 'finish',
    finishReason: toolName ? 'tool-calls' : 'stop',
    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
  });
  return { stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }), warnings: [] };
}

async function withinDeadline<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readRuns() {
  const response = await fetch(`http://localhost:${INNGEST_PORT}/v0/gql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        '{ runs(first:100, filter:{from:"2020-01-01T00:00:00Z"}, orderBy:[{field:QUEUED_AT,direction:DESC}]) { edges { node { id status triggerIDs } } } }',
    }),
    signal: AbortSignal.timeout(5000),
  });
  expect(response.ok).toBe(true);
  return runsSchema.parse(await response.json()).data.runs.edges.map(edge => edge.node);
}

it.each([
  { name: 'steady', interrupt: false, retries: 2, expectedStatus: 'COMPLETED', omegaStarts: 1 },
  { name: 'kill-retry', interrupt: true, retries: 2, expectedStatus: 'COMPLETED', omegaStarts: 2 },
  { name: 'kill-noretry', interrupt: true, retries: 0, expectedStatus: 'FAILED', omegaStarts: 1 },
])(
  '$name: preserves delegated commits and the supervisor terminal state',
  { retry: 0, timeout: 120_000 },
  async variant => {
    expect(process.env.INNGEST_DEV_EXTERNAL).not.toBe('true');
    const controller = new AbortController();
    const analystAttempts = new Set<Promise<{ code: typeof OMEGA }>>();
    const counts = { alphaStarts: 0, alphaCommits: 0, omegaStarts: 0, omegaCommits: 0 };
    const reports: { alpha: string; omega: string }[] = [];
    const id = generateTestId();
    const supervisorId = `supervisor-${id}`;
    const failures: unknown[] = [];
    let disposeStream: (() => Promise<void>) | undefined;
    const cleanup = async (label: string, action: () => unknown | Promise<unknown>) => {
      try {
        await withinDeadline(Promise.resolve().then(action), label);
      } catch (error) {
        failures.push(error);
      }
    };

    try {
      await setupSharedTestInfrastructure({
        retries: variant.retries,
        fastRetries: true,
      });
      // Observe real event sends to join this supervisor to its outer Inngest run.
      const sends = vi.spyOn(getSharedInngest(), 'send');

      const researcher = new Agent({
        id: `researcher-${id}`,
        name: 'researcher',
        description: 'Look up Alpha',
        instructions: 'Look up Alpha.',
        model: new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            const content = JSON.stringify(prompt.filter(message => message.role === 'tool'));
            return content.includes(ALPHA) ? response(undefined, {}, ALPHA) : response('lookupAlpha');
          },
        }),
        tools: {
          lookupAlpha: createTool({
            id: 'lookupAlpha',
            description: 'Look up Alpha',
            inputSchema: z.object({}),
            outputSchema: z.object({ code: z.literal(ALPHA) }),
            execute: async () => {
              counts.alphaStarts++;
              counts.alphaCommits++;
              return { code: ALPHA };
            },
          }),
        },
      });
      const analyst = new Agent({
        id: `analyst-${id}`,
        name: 'analyst',
        description: 'Look up Omega',
        instructions: 'Look up Omega.',
        model: new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            const content = JSON.stringify(prompt.filter(message => message.role === 'tool'));
            return content.includes(OMEGA) ? response(undefined, {}, OMEGA) : response('lookupOmega');
          },
        }),
        tools: {
          lookupOmega: createTool({
            id: 'lookupOmega',
            description: 'Look up Omega',
            inputSchema: z.object({}),
            outputSchema: z.object({ code: z.literal(OMEGA) }),
            execute: () => {
              const attempt = (async () => {
                counts.omegaStarts++;
                if (variant.interrupt && counts.omegaStarts === 1) {
                  try {
                    expect(counts.alphaCommits).toBe(1);
                    expect(counts.omegaCommits).toBe(0);
                    dropSharedHandlerConnections();
                  } catch (error) {
                    // Tool errors become model-visible results; preserve the original test failure.
                    failures.push(error);
                    throw error;
                  }
                  // Match function-retries.test.ts: socket loss does not stop in-flight side effects.
                  await new Promise(resolve => setTimeout(resolve, 1500));
                }
                counts.omegaCommits++;
                return { code: OMEGA } as const;
              })();
              analystAttempts.add(attempt);
              void attempt.finally(() => analystAttempts.delete(attempt)).catch(() => {});
              return attempt;
            },
          }),
        },
      });
      const supervisor = createInngestAgent({
        inngest: getSharedInngest(),
        retries: variant.retries,
        agent: new Agent({
          id: supervisorId,
          name: 'supervisor',
          instructions: 'Delegate to researcher, then analyst, then submit the report.',
          agents: { researcher, analyst },
          model: new MockLanguageModelV2({
            doStream: async ({ prompt }) => {
              const content = JSON.stringify(prompt.filter(message => message.role === 'tool'));
              if (content.includes('report-submitted')) return response(undefined, {}, 'Report submitted.');
              if (!content.includes(ALPHA)) return response('agent-researcher', { prompt: 'Look up Alpha.' });
              if (!content.includes(OMEGA)) return response('agent-analyst', { prompt: 'Look up Omega.' });
              const alpha = content.match(/alpha-\d+/)?.[0];
              const omega = content.match(/omega-\d+/)?.[0];
              return response('submitReport', { alpha, omega });
            },
          }),
          tools: {
            submitReport: createTool({
              id: 'submitReport',
              description: 'Submit both codes',
              inputSchema: z.object({ alpha: z.literal(ALPHA), omega: z.literal(OMEGA) }),
              outputSchema: z.object({ status: z.literal('report-submitted') }),
              execute: async input => {
                reports.push(input);
                return { status: 'report-submitted' as const };
              },
            }),
          },
        }),
      });
      getSharedMastra().addAgent(supervisor);
      expect(isInngestAgent(supervisor)).toBe(true);
      const result = await supervisor.stream('Find both codes and submit a report.', {
        maxSteps: 8,
        abortSignal: controller.signal,
      });
      disposeStream = async () => {
        result.cleanup();
      };
      const chunks: string[] = [];
      const reader = result.output.fullStream.getReader();
      let streamSettled = false;
      const drain = (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            chunks.push(value.type);
          }
        } finally {
          streamSettled = true;
        }
      })();
      // The no-retry run may reject its stream; attach a handler before waiting on run status.
      void drain.catch(() => {});
      disposeStream = async () => {
        try {
          await withinDeadline(reader.cancel(), 'cancel stream reader');
          await withinDeadline(
            drain.catch(() => {}),
            'drain stream reader',
          );
        } finally {
          result.cleanup();
        }
      };
      {
        let terminalRun: Awaited<ReturnType<typeof readRuns>>[number] | undefined;
        await vi.waitFor(
          async () => {
            const matchingSends = sends.mock.calls.flatMap(([event], index) => {
              const trigger = triggerSchema.safeParse(event);
              return trigger.success && trigger.data.data.runId === result.runId
                ? [{ trigger: trigger.data, result: sends.mock.results[index]! }]
                : [];
            });
            expect(matchingSends, 'One trigger event must match the supervisor Mastra run').toHaveLength(1);
            const sent = matchingSends[0]!;
            expect(sent.trigger.data.inputData.agentId).toBe(supervisorId);
            expect(sent.result.type).toBe('return');
            const { ids } = z.object({ ids: z.array(z.string()).length(1) }).parse(await sent.result.value);
            const candidates = (await readRuns()).filter(run => run.triggerIDs.includes(ids[0]!));
            expect(candidates, 'Exactly one outer Inngest run must match the supervisor trigger').toHaveLength(1);
            terminalRun = candidates[0]!;
            expect(['COMPLETED', 'FAILED', 'CANCELLED']).toContain(terminalRun.status);
          },
          { timeout: 30_000, interval: 100 },
        );

        expect(terminalRun?.status, 'Correlated supervisor terminal status').toBe(variant.expectedStatus);
        await vi.waitFor(
          () => expect(analystAttempts.size, 'All analyst attempts must finish before counting commits').toBe(0),
          {
            timeout: 5000,
          },
        );
        expect(counts).toEqual({
          alphaStarts: 1,
          alphaCommits: 1,
          omegaStarts: variant.omegaStarts,
          omegaCommits: counts.omegaStarts,
        });
        expect(reports).toEqual(variant.expectedStatus === 'FAILED' ? [] : [{ alpha: ALPHA, omega: OMEGA }]);
        if (variant.expectedStatus === 'COMPLETED') {
          await vi.waitFor(() => expect(streamSettled).toBe(true), { timeout: 5000 });
          await drain;
          expect(chunks.at(-1)).toBe('finish');
          expect(chunks).not.toContain('error');
        }
      }
    } catch (error) {
      failures.push(error);
    } finally {
      await cleanup('settle in-flight analyst attempts', () => Promise.allSettled([...analystAttempts]));
      controller.abort();
      await cleanup('stop the owned Inngest scheduler', stopSharedInngestDevServer);
      if (disposeStream) await cleanup('dispose the stream subscription', disposeStream);
      await cleanup('close shared HTTP infrastructure', () => teardownSharedTestInfrastructure({ forceClose: true }));
      await cleanup('verify both listening ports were released', async () => {
        for (const port of [INNGEST_PORT, HANDLER_PORT]) {
          await expect(
            fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(1000) }),
          ).rejects.toThrow();
        }
      });
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Scenario and cleanup failures');
  },
);
