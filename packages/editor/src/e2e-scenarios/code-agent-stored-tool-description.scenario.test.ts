import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createEditorScenarioMastra, createPromptEchoModel } from './editor-scenario-utils';

describe('Editor E2E scenario: code agent tool ownership', () => {
  it('keeps code-owned tool implementations while applying stored description overrides', async () => {
    // USER STORY: A Studio user edits a code agent tool description without replacing the tool implementation.
    // ARRANGE: Register a code-defined agent that lets Editor own only tool descriptions.
    const weatherTool = createTool({
      id: 'weather-tool',
      description: 'Code-owned weather description',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ forecast: z.string() }),
      execute: async ({ city }: { city: string }) => ({ forecast: `sunny in ${city}` }),
    });
    const codeAgent = new Agent({
      id: 'code-weather-agent',
      name: 'Code Weather Agent',
      instructions: 'Use the code weather tool.',
      model: createPromptEchoModel(),
      tools: { 'weather-tool': weatherTool },
      editor: { tools: { description: true } },
    });
    const { storage, editor } = createEditorScenarioMastra({
      agents: { 'code-weather-agent': codeAgent },
    });
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'code-weather-agent',
        name: 'Code Weather Override',
        model: { provider: 'mock', name: 'editor-scenario' },
        tools: { 'weather-tool': { description: 'Studio-edited weather description' } },
      },
    });

    // ACT: Resolve the code agent through Editor overrides and inspect the runtime tool surface.
    const resolved = await editor.agent.applyStoredOverrides(codeAgent);
    const tools = await resolved.listTools();
    const output = await tools['weather-tool'].execute?.({ city: 'Paris' } as never, {} as never);

    // ASSERT: The user-facing description changes, but the original executable behavior remains intact.
    expect(tools['weather-tool'].description).toBe('Studio-edited weather description');
    expect(output).toEqual({ forecast: 'sunny in Paris' });
  });
});
