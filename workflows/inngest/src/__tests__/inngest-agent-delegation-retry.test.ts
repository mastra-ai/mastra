/**
 * Ported from validation harness case T10 (inngest).
 * The kill-* variants drop the analyst's HTTP request in the same process, not
 * SIGKILL. Ordinary tool throws become tool results, not Inngest function retries.
 * This tests transport retry and delegation memoization, not process-death recovery.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';
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
const invocationSchema = z.object({
  ctx: z.object({
    attempt: z.number(),
    max_attempts: z.number(),
    fn_id: z.string(),
    run_id: z.string(),
    request_id: z.string(),
  }),
  event: z.object({
    id: z.string(),
    name: z.string(),
    data: z
      .object({
        runId: z.string(),
        inputData: z.object({ agentId: z.string() }).passthrough(),
      })
      .passthrough(),
  }),
});
type Invocation = z.infer<typeof invocationSchema>;
type RequestScope = {
  incoming: IncomingMessage | Http2ServerRequest;
  invocation: Invocation;
};
const requestScope = new AsyncLocalStorage<RequestScope>();
const runSchema = z.object({
  data: z.object({
    run: z.object({ id: z.string(), status: z.string(), functionID: z.string(), triggerIDs: z.array(z.string()) }),
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

async function readRun(id: string) {
  const response = await fetch(`http://localhost:${INNGEST_PORT}/v0/gql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: `{ run(runID: "${id}") { id status functionID triggerIDs } }` }),
    signal: AbortSignal.timeout(5000),
  });
  expect(response.ok).toBe(true);
  return runSchema.parse(await response.json()).data.run;
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
    const abandoned = Promise.withResolvers<void>();
    let abandonedSignal: AbortSignal | undefined;
    let abandonedSettled = false;
    let interruptedRequest: Invocation | undefined;
    const invocations: Invocation[] = [];
    const disconnected: { invocation: Invocation; finished: boolean }[] = [];
    const activeHandlers = new Set<Promise<Response>>();
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
        onRequest: async (request, bindings, handle) => {
          if (request.method !== 'POST') return handle();
          const invocation = invocationSchema.parse(await request.clone().json());
          invocations.push(invocation);
          bindings.outgoing.once('close', () => {
            disconnected.push({ invocation, finished: bindings.outgoing.writableFinished });
          });
          const task = requestScope.run({ incoming: bindings.incoming, invocation }, () => Promise.resolve(handle()));
          activeHandlers.add(task);
          try {
            return await task;
          } finally {
            activeHandlers.delete(task);
          }
        },
      });

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
            execute: async (_input, context) => {
              counts.omegaStarts++;
              if (variant.interrupt && counts.omegaStarts === 1) {
                let request: RequestScope | undefined;
                try {
                  expect(counts.alphaCommits).toBe(1);
                  expect(counts.omegaCommits).toBe(0);
                  request = requestScope.getStore();
                  if (!request) throw new Error('Analyst tool is not executing inside an Inngest HTTP request');
                  interruptedRequest = request.invocation;
                  expect(interruptedRequest.event.data.inputData.agentId).toBe(supervisorId);
                  expect(interruptedRequest.ctx.attempt).toBe(0);
                  expect(interruptedRequest.ctx.max_attempts).toBe(variant.retries + 1);
                  abandonedSignal = context?.abortSignal;
                  expect(abandonedSignal).toBeDefined();
                } catch (error) {
                  // Tool errors become model-visible results; preserve the original test failure.
                  failures.push(error);
                  throw error;
                }
                request.incoming.socket.destroy();
                try {
                  await abandoned.promise;
                  abandonedSignal?.throwIfAborted();
                  throw new Error('Abandoned tool was released without cancellation');
                } finally {
                  abandonedSettled = true;
                }
              }
              counts.omegaCommits++;
              return { code: OMEGA };
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
        let terminalRun: Awaited<ReturnType<typeof readRun>> | undefined;
        await vi.waitFor(
          async () => {
            const candidates = invocations.filter(
              invocation => invocation.event.name === LOOP_EVENT && invocation.event.data.runId === result.runId,
            );
            const ids = new Set(candidates.map(invocation => invocation.ctx.run_id));
            expect(ids.size, 'Exactly one outer Inngest run must match the supervisor Mastra run').toBe(1);
            const outer = candidates[0]!;
            expect(outer.event.data.inputData.agentId).toBe(supervisorId);
            terminalRun = await readRun(outer.ctx.run_id);
            expect(terminalRun.id).toBe(outer.ctx.run_id);
            expect(terminalRun.functionID).toBe(outer.ctx.fn_id);
            expect(terminalRun.triggerIDs).toContain(outer.event.id);
            expect(['COMPLETED', 'FAILED', 'CANCELLED']).toContain(terminalRun.status);
          },
          { timeout: 30_000, interval: 100 },
        );

        expect(terminalRun?.status, 'Correlated supervisor terminal status').toBe(variant.expectedStatus);
        expect(counts).toEqual({
          alphaStarts: 1,
          alphaCommits: 1,
          omegaStarts: variant.omegaStarts,
          omegaCommits: variant.expectedStatus === 'FAILED' ? 0 : 1,
        });
        expect(reports).toEqual(variant.expectedStatus === 'FAILED' ? [] : [{ alpha: ALPHA, omega: OMEGA }]);
        if (variant.interrupt) {
          expect(interruptedRequest?.event.data.runId).toBe(result.runId);
          expect(disconnected.filter(request => !request.finished)).toEqual([
            { invocation: interruptedRequest, finished: false },
          ]);
          await vi.waitFor(
            async () => {
              const executionRun = await readRun(interruptedRequest!.ctx.run_id);
              expect(executionRun.id).not.toBe(terminalRun?.id);
              expect(executionRun.functionID).toBe(interruptedRequest!.ctx.fn_id);
              expect(executionRun.triggerIDs).toContain(interruptedRequest!.event.id);
              expect(executionRun.status).toBe(variant.expectedStatus);
            },
            { timeout: 5000 },
          );
          expect(abandonedSettled, 'Interrupted attempt must not commit or return before cleanup').toBe(false);
        }
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
      const beforeCleanup = { counts: { ...counts }, reports: [...reports] };
      controller.abort();
      if (interruptedRequest) {
        await cleanup('propagate cancellation to the abandoned tool', () =>
          vi.waitFor(() => expect(abandonedSignal?.aborted, 'Parked analyst tool receives cancellation').toBe(true), {
            timeout: 5000,
          }),
        );
      }
      await cleanup('stop the owned Inngest scheduler', stopSharedInngestDevServer);
      // Always release the abandonment-only branch, even when cancellation or shutdown failed.
      abandoned.resolve();
      await cleanup('drain handler invocations without late commits', async () => {
        if (interruptedRequest) {
          await vi.waitFor(() => expect(abandonedSettled).toBe(true), { timeout: 5000 });
        }
        await vi.waitFor(() => expect(activeHandlers.size).toBe(0), { timeout: 5000 });
        expect({ counts, reports }, 'Cleanup must not create tool commits or reports').toEqual(beforeCleanup);
      });
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
