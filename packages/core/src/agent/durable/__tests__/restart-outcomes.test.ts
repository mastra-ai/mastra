import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { consumeText, createGate, createRestartScenario } from './restart-harness';

describe('native outcomes after a process restart', () => {
  const getMock = useLoopScenarioAimock();

  it.each(['durable', 'evented'] as const)(
    '%s preserves the interrupted execution and the recovered success',
    async kind => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'lookup-call', name: 'lookup', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Recovered answer' });
      const gate = createGate();
      const scenario = createRestartScenario({
        kind,
        runId: `outcome-restart-${kind}`,
        observability: async () => {
          const { Observability } = await import('../../../../../../observability/mastra/src/default');
          const { MastraStorageExporter } =
            await import('../../../../../../observability/mastra/src/exporters/mastra-storage');
          return new Observability({
            configs: {
              default: {
                serviceName: 'restart-outcomes',
                exporters: [new MastraStorageExporter({ maxBatchWaitMs: 60_000 })],
              },
            },
          });
        },
        build: ({ core, generation }) =>
          new core.Agent({
            id: 'restart-outcomes',
            name: 'restart-outcomes',
            instructions: 'Look up the answer.',
            model: createOpenAI({ apiKey: 'test', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
            tools: {
              lookup: core.createTool({
                id: 'lookup',
                description: 'Look up an answer',
                inputSchema: z.object({}),
                execute: async () => {
                  if (generation === 1) await gate.wait();
                  return { answer: 'found' };
                },
              }),
            },
          }),
      });
      let consume: Promise<string> | undefined;
      try {
        const original = await scenario.start(({ agent, runId }) => agent.stream('Look it up', { runId }));
        consume = original.driven.then(consumeText);
        await gate.reached;
        await original.graph.mastra.observability.getDefaultInstance().flush();
        const recovered = await scenario.restart(await original.checkpoint());
        expect(recovered.text).toBe('Recovered answer');
        expect(recovered.executionError).toBeUndefined();
        await recovered.graph.mastra.observability.getDefaultInstance().flush();
        const store = await recovered.graph.storage.getStore('observability');
        const roots = await store.listTraces({});
        expect(roots.spans).toHaveLength(1);
        const trace = await store.getTrace({ traceId: roots.spans[0].traceId });
        const agents = trace.spans.filter((span: { spanType: string }) => span.spanType === 'agent_run');
        expect(agents).toHaveLength(2);
        const interrupted = agents.find((span: { name: string }) => !span.name.includes('(recovered)'));
        const completed = agents.find((span: { name: string }) => span.name.includes('(recovered)'));
        expect(interrupted).toMatchObject({
          outcome: 'interrupted',
          stopReason: null,
          stopReasonContext: null,
        });
        expect(completed).toMatchObject({
          outcome: 'success',
        });
        for (const agent of [interrupted, completed]) {
          expect(
            trace.spans.find(
              (span: { spanType: string; parentSpanId: string }) =>
                span.spanType === 'model_generation' && span.parentSpanId === agent.spanId,
            ),
          ).toMatchObject({ outcome: agent.outcome });
        }
      } finally {
        gate.release();
        await consume;
        await scenario.stop();
      }
    },
    30_000,
  );
});
