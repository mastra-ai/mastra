import { describe, expect, it } from 'vitest';

import {
  summarizeActiveToolsForSpan,
  summarizeProcessorModelForSpan,
  summarizeProcessorResultForSpan,
  summarizeProcessorToolsForSpan,
  summarizeToolChoiceForSpan,
} from './span-payload';

describe('processor span summaries', () => {
  it('summarizes models to the standard safe shape', () => {
    expect(
      summarizeProcessorModelForSpan({
        modelId: 'gpt-test',
        provider: 'openai',
        specificationVersion: 'v2',
        apiKey: 'secret',
      }),
    ).toEqual({
      modelId: 'gpt-test',
      provider: 'openai',
      specificationVersion: 'v2',
    });

    expect(
      summarizeProcessorModelForSpan({
        id: 'legacy-model',
        provider: 'anthropic',
        specificationVersion: 'v1',
      }),
    ).toEqual({
      modelId: 'legacy-model',
      provider: 'anthropic',
      specificationVersion: 'v1',
    });
  });

  it('summarizes tools and active tools with ids and names', () => {
    const tools = {
      weather: {
        id: 'weather-tool',
        name: 'Weather Tool',
        description: 'Checks the weather',
        client: { token: 'secret' },
      },
      search: {
        description: 'Searches the web',
      },
    };

    expect(summarizeProcessorToolsForSpan(tools)).toEqual([
      {
        id: 'weather-tool',
        name: 'Weather Tool',
        description: 'Checks the weather',
      },
      {
        id: 'search',
        name: 'search',
        description: 'Searches the web',
      },
    ]);

    expect(summarizeActiveToolsForSpan(['weather-tool', 'search'], tools)).toEqual([
      {
        id: 'weather-tool',
        name: 'Weather Tool',
      },
      {
        id: 'search',
        name: 'search',
      },
    ]);

    expect(summarizeActiveToolsForSpan(['weather', 'search'], tools)).toEqual([
      {
        id: 'weather-tool',
        name: 'Weather Tool',
      },
      {
        id: 'search',
        name: 'search',
      },
    ]);

    expect(summarizeProcessorToolsForSpan({})).toEqual([]);
    expect(summarizeActiveToolsForSpan([], tools)).toEqual([]);
  });

  it('normalizes toolChoice to a stable object shape', () => {
    const tools = {
      weather: {
        id: 'weather-tool',
        name: 'Weather Tool',
      },
    };

    expect(summarizeToolChoiceForSpan('auto', tools)).toEqual({ type: 'auto' });
    expect(summarizeToolChoiceForSpan({ type: 'tool', toolName: 'weather-tool' }, tools)).toEqual({
      type: 'tool',
      tool: {
        id: 'weather-tool',
        name: 'Weather Tool',
      },
    });
    expect(summarizeToolChoiceForSpan({ type: 'tool', toolName: 'weather' }, tools)).toEqual({
      type: 'tool',
      tool: {
        id: 'weather-tool',
        name: 'Weather Tool',
      },
    });
  });

  it('summarizes output results without carrying raw step arrays', () => {
    expect(
      summarizeProcessorResultForSpan({
        text: 'done',
        finishReason: 'stop',
        toolCalls: [{ toolName: 'weather' }],
        steps: [{ text: 'step 1' }, { text: 'step 2' }],
        providerOptions: { headers: { Authorization: 'Bearer secret' } },
      }),
    ).toEqual({
      text: 'done',
      finishReason: 'stop',
      toolCalls: [{ toolName: 'weather' }],
      stepCount: 2,
    });
  });
});
