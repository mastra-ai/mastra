/**
 * A durable run's sampling decision is made once, when it starts. A run the sampler declined stays
 * unrecorded through a resume on the same worker or a fresh one: no span of any type and no score,
 * even when the sampler would accept every root span it is asked about afterwards. The sampled
 * control cells show the same assertions can see spans and scores.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent, globalRunRegistry } from '@mastra/core/agent/durable';
import { createScorer } from '@mastra/core/evals';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { Mastra } from '@mastra/core/mastra';
import { SamplingStrategyType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const SCORER_ID = 'unsampled-run-scorer';
let scorerRuns = 0;
registerHook(AvailableHooks.ON_SCORER_RUN, (payload: { scorer?: { id?: string } }) => {
  if (payload.scorer?.id === SCORER_ID) scorerRuns++;
});

function approvalThenTextModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        ...(++calls === 1
          ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'work', input: '{}' }]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
            ]),
        { type: 'finish', finishReason: calls === 1 ? 'tool-calls' : 'stop', usage },
      ] as any[]),
    }),
  });
}

function countByType(exporter: TestExporter): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const span of exporter.getAllSpans()) counts[span.type] = (counts[span.type] ?? 0) + 1;
  return counts;
}

describe('a run the sampler declined stays unrecorded through resume', () => {
  for (const engine of ['durable', 'evented'] as const) {
    for (const cold of [false, true]) {
      for (const startSampled of [false, true]) {
        const cell = `${engine} ${cold ? 'cold' : 'warm'} resume, start ${startSampled ? 'sampled' : 'declined'}`;
        it(
          cell,
          async () => {
            scorerRuns = 0;
            const model = approvalThenTextModel();
            const storage = new InMemoryStore();
            const exporter = new TestExporter({ validateLifecycle: false, logMetricsOnFlush: false });
            // Only the run's first root decision can decline; every later one accepts.
            let decision = startSampled;
            const sampler = () => {
              const current = decision;
              decision = true;
              return current;
            };
            const scorer = createScorer({
              id: SCORER_ID,
              name: SCORER_ID,
              description: 'scores every run',
            }).generateScore(() => 1);
            const build = () => {
              const agent = new Agent({
                id: `unsampled-${engine}`,
                name: 'unsampled',
                instructions: 'Use the tool, then answer.',
                model,
                scorers: { s: { scorer } },
                tools: {
                  work: createTool({
                    id: 'work',
                    description: 'Needs approval',
                    inputSchema: z.object({}),
                    requireApproval: true,
                    execute: async () => ({ ok: true }),
                  }),
                },
              });
              const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
              const mastra = new Mastra({
                agents: { runner },
                storage,
                logger: false,
                observability: new Observability({
                  configs: {
                    test: {
                      serviceName: 'unsampled-run',
                      exporters: [exporter],
                      sampling: { type: SamplingStrategyType.CUSTOM, sampler },
                    },
                  },
                }),
              });
              return { runner, mastra };
            };
            let { runner, mastra } = build();
            try {
              const first = await runner.generate('go', { maxSteps: 5 });
              expect(first.finishReason).toBe('suspended');
              if (cold) {
                await mastra.shutdown();
                globalRunRegistry.clear();
                ({ runner, mastra } = build());
              }
              const resumed = await runner.resumeGenerate(
                first.runId,
                { approved: true },
                { toolCallId: 'call-1', maxSteps: 5 },
              );
              expect(resumed.finishReason).toBe('stop');
              if (startSampled) {
                await vi.waitFor(() => expect(scorerRuns).toBe(1), { timeout: 5_000 });
              } else {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              await mastra.observability?.flush();

              const spans = countByType(exporter);
              if (startSampled) {
                expect(spans.agent_run).toBe(2);
                expect(spans.model_generation).toBe(2);
                expect(spans.tool_call).toBe(1);
                expect(exporter.getScoreEvents()).toHaveLength(1);
              } else {
                expect(spans, 'no span of any type').toEqual({});
                expect(scorerRuns, 'no scorer ran').toBe(0);
                expect(exporter.getScoreEvents(), 'no score exported').toEqual([]);
              }
            } finally {
              await mastra.shutdown();
            }
          },
          30_000,
        );
      }
    }
  }
});
