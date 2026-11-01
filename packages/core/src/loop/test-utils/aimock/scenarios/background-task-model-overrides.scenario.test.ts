import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Issue #28638: every background-eligible tool used to carry a model-facing
 * `_background` object (5 optional parameters). Five strict background tools
 * therefore exceeded Anthropic's limit of 24 optional parameters per request.
 *
 * With `background: { modelOverrides: false }`, the tool still runs in the
 * background but the provider request carries no `_background` field and the
 * system prompt does not tell the model to send one.
 */
describeForAllEngines(
  'background-task-model-overrides scenario',
  engine => {
    const getMock = useLoopScenarioAimock();

    function makeTools(modelOverrides: boolean | undefined, executed: string[]) {
      return Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => {
          const id = `bg-tool-${i}`;
          return [
            id,
            createTool({
              id,
              description: `Background tool ${i}`,
              strict: true,
              inputSchema: z.object({ query: z.string() }),
              background: { enabled: true, ...(modelOverrides === undefined ? {} : { modelOverrides }) },
              execute: async ({ query }) => {
                executed.push(id);
                return { result: `${id}:${query}` };
              },
            }),
          ];
        }),
      );
    }

    async function run(modelOverrides: boolean | undefined) {
      const executed: string[] = [];
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Run bg-tool-0 with query docs',
        tools: makeTools(modelOverrides, executed),
        stopWhen: stepCountIs(3),
        backgroundTasks: { enabled: true },
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_bg', name: 'bg-tool-0', arguments: { query: 'docs' } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Dispatched.' });
        },
      });
      const body = result.requests[0]?.body as any;
      const tools: any[] = body?.tools ?? [];
      const systemText = JSON.stringify((body?.messages ?? []).filter((m: any) => m.role === 'system'));
      return { ...result, tools, systemText, executed };
    }

    it('sends no _background field for fixed background tools and still dispatches in the background', async () => {
      const { tools, systemText, chunks } = await run(false);

      expect(tools).toHaveLength(5);
      for (const tool of tools) {
        expect(tool.function.parameters.properties).toHaveProperty('query');
        expect(tool.function.parameters.properties).not.toHaveProperty('_background');
      }
      expect(systemText).toContain('bg-tool-0');
      expect(systemText).not.toContain('_background');

      const started = chunks?.find(c => c.type === 'background-task-started');
      expect(started?.payload).toMatchObject({ toolName: 'bg-tool-0' });
    });

    it('keeps advertising _background when modelOverrides is not set', async () => {
      const { tools, systemText } = await run(undefined);

      expect(tools).toHaveLength(5);
      for (const tool of tools) {
        expect(tool.function.parameters.properties).toHaveProperty('_background');
      }
      expect(systemText).toContain('_background');
    });
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
