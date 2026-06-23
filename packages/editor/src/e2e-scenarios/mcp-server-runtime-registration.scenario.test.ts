import { describe, expect, it, vi } from 'vitest';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createEditorScenarioMastra } from './editor-scenario-utils';

const weatherTool = createTool({
  id: 'weatherTool',
  description: 'Looks up weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ forecast: z.string() }),
  execute: async inputData => ({ forecast: `Sunny in ${inputData.city}` }),
});

describe('editor e2e scenario: MCP server runtime registration', () => {
  it('hydrates a stored MCP server into runtime tools and keeps missing references out', async () => {
    // USER STORY: A Studio user exposes a curated MCP server and expects only valid referenced tools to be callable.
    // ARRANGE
    const warn = vi.fn();
    const { editor, mastra } = createEditorScenarioMastra({
      tools: { weatherTool },
      logger: {
        warn,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });

    // ACT
    const server = await editor.mcpServer.create({
      id: 'studio-weather-mcp',
      name: 'Studio Weather MCP',
      version: '1.0.0',
      tools: {
        weatherTool: { description: 'Studio curated weather lookup' },
        missingTool: {},
      },
    });

    // ASSERT
    const registered = mastra.getMCPServer('studio-weather-mcp');
    expect(registered).toBe(server);

    const tools = server.tools();
    expect(Object.keys(tools)).toEqual(['weatherTool']);
    expect(tools.weatherTool.description).toBe('Studio curated weather lookup');
    await expect(tools.weatherTool.execute!({ city: 'Austin' }, {} as never)).resolves.toEqual({
      forecast: 'Sunny in Austin',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missingTool'));
  });
});
