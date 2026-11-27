import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../../../agent';
import { webSearchTool } from '../../../tools/builtin/web-search';

/**
 * A fresh project switched to Mastra Gateway (`mastra/<provider>/<model>`) but run without
 * MASTRA_GATEWAY_API_KEY. The Mastra gateway is disabled without a key, so the router fell back to
 * models.dev and every message failed with errors that never named the key:
 * "Could not find config for provider mastra", or, with webSearchTool, "Could not infer a supported
 * provider from "mastra"".
 */
describe('Mastra Gateway model without MASTRA_GATEWAY_API_KEY', () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey = process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_API_KEY;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
    else process.env.MASTRA_GATEWAY_API_KEY = savedKey;
  });

  const createAgent = (model: string, tools: Record<string, unknown> = {}) =>
    new Agent({
      id: 'research-agent',
      name: 'Research Agent',
      instructions: 'Use web search when you need current information.',
      model,
      tools: tools as any,
    });

  const missingKey = 'Set MASTRA_GATEWAY_API_KEY to use "mastra/openai/gpt-5-mini" through Mastra Gateway';

  it('tells the user to set the key when generating', async () => {
    await expect(createAgent('mastra/openai/gpt-5-mini').generate('Hi')).rejects.toThrow(missingKey);
  });

  it('tells the user to set the key when streaming', async () => {
    const error = await createAgent('mastra/openai/gpt-5-mini')
      .stream('Hi')
      .then(stream => stream.getFullOutput())
      .then(
        output => (output as { error?: unknown }).error,
        (e: unknown) => e,
      );
    expect(String((error as Error)?.message ?? error)).toContain(missingKey);
  });

  it.each(['mastra/openai/gpt-5-mini', 'mastra/anthropic/claude-sonnet-4-5'])(
    '%s with webSearchTool fails the same way as without it',
    async model => {
      const withoutWebSearch = await createAgent(model)
        .generate('What happened in the news today?')
        .catch((e: Error) => e);
      expect(withoutWebSearch).toBeInstanceOf(Error);

      await expect(
        createAgent(model, { webSearch: webSearchTool }).generate('What happened in the news today?'),
      ).rejects.toThrow((withoutWebSearch as Error).message);
    },
  );
});
