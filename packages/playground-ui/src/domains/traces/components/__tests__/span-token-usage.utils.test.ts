// @vitest-environment jsdom
import type { UsageStats } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { getModelFacts, getTokenUsageRows } from '../span-token-usage.utils';

describe('getTokenUsageRows', () => {
  it('returns null when no side reports a token count', () => {
    expect(getTokenUsageRows(undefined)).toBeNull();
    expect(getTokenUsageRows({})).toBeNull();
    expect(getTokenUsageRows({ inputDetails: { text: 50 } })).toBeNull();
  });

  it('gives each side its total and its non-zero breakdown', () => {
    expect(
      getTokenUsageRows({
        inputTokens: 6606,
        outputTokens: 365,
        inputDetails: { cacheRead: 5632, cacheWrite: 0, text: 974 },
        outputDetails: { reasoning: 256, text: 109 },
      }),
    ).toEqual([
      { label: 'Input', total: 6606, breakdown: '5,632 cached · 974 text' },
      { label: 'Output', total: 365, breakdown: '256 reasoning · 109 text' },
    ]);
  });

  it('only lists the sides that report a count', () => {
    expect(getTokenUsageRows({ inputTokens: 100, outputDetails: { text: 50 } })).toEqual([
      { label: 'Input', total: 100, breakdown: undefined },
    ]);
  });
});

describe('getModelFacts', () => {
  const modelSpan = {
    spanType: SpanType.MODEL_GENERATION,
    startedAt: '2026-10-26T11:28:14.930Z',
    endedAt: '2026-10-26T11:28:20.504Z',
    attributes: {
      model: 'gpt-5-mini',
      provider: 'openai',
      finishReason: 'stop',
      completionStartTime: '2026-10-26T11:28:16.376Z',
      usage: { inputTokens: 6606, outputTokens: 365 },
    },
  };

  it('reads the model, how it finished, the time to first token and the output speed', () => {
    expect(getModelFacts(modelSpan)).toEqual({
      model: 'gpt-5-mini',
      provider: 'openai',
      finishReason: 'stop',
      firstToken: '1.45s',
      speed: '88 tok/s',
    });
  });

  it('leaves out the timings when the span never streamed a first chunk', () => {
    const { completionStartTime: _, ...attributes } = modelSpan.attributes;
    expect(getModelFacts({ ...modelSpan, attributes })).toEqual({
      model: 'gpt-5-mini',
      provider: 'openai',
      finishReason: 'stop',
      firstToken: undefined,
      speed: undefined,
    });
  });

  it('gives nothing for spans that are not model calls', () => {
    expect(getModelFacts({ ...modelSpan, spanType: SpanType.AGENT_RUN })).toEqual({});
  });
});
