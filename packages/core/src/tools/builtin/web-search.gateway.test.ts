import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { webSearchTool } from './web-search';

/**
 * A fresh project switched to Mastra Gateway (`mastra/<provider>/<model>`) but run without
 * MASTRA_GATEWAY_API_KEY: the Mastra gateway is disabled, so the router reports the model's
 * provider as `mastra`. webSearchTool then failed every message with "Could not infer a supported
 * provider from "mastra"", hiding the error the same agent gets without the tool.
 */
describe('webSearchTool on a Mastra Gateway model without a Gateway key', () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey = process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_API_KEY;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
    else process.env.MASTRA_GATEWAY_API_KEY = savedKey;
  });

  it.each(['mastra/openai/gpt-5-mini', 'mastra/anthropic/claude-sonnet-4-5'])(
    '%s fails the same way with webSearchTool as without it',
    async model => {
      const generateError = (tools: Record<string, unknown>) =>
        new Agent({
          id: 'research-agent',
          name: 'Research Agent',
          instructions: 'Use web search when you need current information.',
          model,
          tools: tools as any,
        })
          .generate('What happened in the news today?')
          .then(
            () => 'no error',
            (e: unknown) => (e as Error).message,
          );

      const withWebSearch = await generateError({ webSearch: webSearchTool });

      expect(withWebSearch).not.toContain('Could not infer a supported provider');
      expect(withWebSearch).toBe(await generateError({}));
    },
  );
});
