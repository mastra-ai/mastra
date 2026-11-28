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

    /**
     * Agent-wide policy (#31614, #31612): tools opted in through
     * `backgroundTasks.tools: 'all'` inherit the agent-level `defaultDisposition`
     * and `modelOverrides` instead of each tool having to repeat them.
     */
    function makeAgentTools(executed: string[]) {
      return Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => {
          const id = `batch-tool-${i}`;
          return [
            id,
            createTool({
              id,
              description: `Agent-wide background tool ${i}`,
              strict: true,
              inputSchema: z.object({ query: z.string() }).strict(),
              execute: async ({ query }) => {
                executed.push(id);
                return { result: `${id}:${query}` };
              },
            }),
          ];
        }),
      );
    }

    async function runAgentWide({
      agentBackgroundTasks,
      callArgs,
      executed,
    }: {
      agentBackgroundTasks: Record<string, unknown>;
      callArgs: Record<string, unknown>;
      executed: string[];
    }) {
      const result = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Run batch-tool-0 with query docs',
        tools: makeAgentTools(executed),
        agentBackgroundTasks,
        stopWhen: stepCountIs(3),
        backgroundTasks: { enabled: true },
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_agent_bg', name: 'batch-tool-0', arguments: callArgs }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Done.' });
        },
      });
      const body = result.requests[0]?.body as any;
      const tools: any[] = body?.tools ?? [];
      const systemText = JSON.stringify((body?.messages ?? []).filter((m: any) => m.role === 'system'));
      return { ...result, tools, systemText, executed };
    }

    it("runs 'all' tools forward with the agent-wide defaultDisposition 'foreground'", async () => {
      const executed: string[] = [];
      const {
        chunks,
        tools,
        executed: ran,
      } = await runAgentWide({
        agentBackgroundTasks: { tools: 'all', defaultDisposition: 'foreground' },
        callArgs: { query: 'docs' },
        executed,
      });

      // Eligibility comes from the agent-wide `'all'` opt-in, so the field is still
      // advertised even though the default disposition is foreground.
      expect(tools[0]?.function.parameters.properties).toHaveProperty('_background');

      // A call that does not opt in returns the real tool result and never
      // dispatches a background task.
      expect(ran).toEqual(['batch-tool-0']);
      expect(chunks?.some(c => c.type === 'background-task-started')).toBe(false);
      expect(chunks?.some(c => c.type === 'tool-result')).toBe(true);
    });

    it("still honors an allowed per-call deferred request under 'all' + defaultDisposition 'foreground'", async () => {
      const executed: string[] = [];
      const { chunks } = await runAgentWide({
        agentBackgroundTasks: { tools: 'all', defaultDisposition: 'foreground' },
        callArgs: { query: 'docs', _background: { disposition: 'deferred' } },
        executed,
      });

      const started = chunks?.find(c => c.type === 'background-task-started');
      expect(started?.payload).toMatchObject({ toolName: 'batch-tool-0' });
    });

    it("hides _background for 'all' + modelOverrides: false and ignores a model-emitted override", async () => {
      const executed: string[] = [];
      const { tools, systemText, chunks } = await runAgentWide({
        agentBackgroundTasks: { tools: 'all', modelOverrides: false, defaultDisposition: 'deferred' },
        callArgs: { query: 'docs', _background: { enabled: false } },
        executed,
      });

      // No tool advertises the field, and the prompt does not ask the model for it,
      // so five strict tools cannot blow past provider optional-parameter limits.
      expect(tools).toHaveLength(5);
      for (const tool of tools) {
        expect(tool.function.parameters.properties).toHaveProperty('query');
        expect(tool.function.parameters.properties).not.toHaveProperty('_background');
      }
      expect(systemText).not.toContain('_background');

      // A model-emitted override is ignored rather than failing the strict schema,
      // so the call resolves to the configured default (deferred) and dispatches.
      const started = chunks?.find(c => c.type === 'background-task-started');
      expect(started?.payload).toMatchObject({ toolName: 'batch-tool-0' });
    });

    it('lets a named per-tool entry override the agent-wide policy on one tool', async () => {
      const executed: string[] = [];
      const { tools } = await runAgentWide({
        agentBackgroundTasks: {
          tools: { 'batch-tool-0': { enabled: true, modelOverrides: true }, 'batch-tool-1': true },
          modelOverrides: false,
        },
        callArgs: { query: 'docs' },
        executed,
      });

      const withOverride = tools.find((t: any) => t.function.name === 'batch-tool-0');
      const withoutOverride = tools.find((t: any) => t.function.name === 'batch-tool-1');

      // The agent-wide `modelOverrides: false` reaches the plain named entry...
      expect(withoutOverride?.function.parameters.properties).not.toHaveProperty('_background');
      // ...while the exception re-enables per-call overrides for one tool.
      expect(withOverride?.function.parameters.properties).toHaveProperty('_background');
    });
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
