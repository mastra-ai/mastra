import type { LanguageModelUsage, ProviderMetadata } from '@mastra/core/stream';
import { describe, it, expect } from 'vitest';
// Test-only source import: the published package must not depend on this core export.
import { extractUsageMetrics as coreExtractUsageMetrics } from '../../../packages/core/src/observability/usage';
import { extractUsageMetrics } from './usage';

/**
 * `extractUsageMetrics` is duplicated in @mastra/core (durable agent steps) and here
 * (regular agent steps) so exporters do not need a newer core. This test fails when the copies drift.
 */
describe('extractUsageMetrics parity with @mastra/core', () => {
  const cases: Array<{ name: string; usage?: LanguageModelUsage; providerMetadata?: ProviderMetadata }> = [
    { name: 'undefined usage' },
    { name: 'basic tokens', usage: { inputTokens: 100, outputTokens: 50 } },
    {
      name: 'OpenAI cached input tokens',
      usage: { inputTokens: 1000, outputTokens: 10, totalTokens: 1010, cachedInputTokens: 900 },
    },
    {
      name: 'AI SDK inputTokenDetails',
      usage: {
        inputTokens: 1000,
        outputTokens: 20,
        inputTokenDetails: { cacheReadTokens: 600, cacheWriteTokens: 100 },
        reasoningTokens: 5,
      } as LanguageModelUsage,
    },
    {
      name: 'Anthropic providerMetadata',
      usage: { inputTokens: 100, outputTokens: 10 },
      providerMetadata: {
        anthropic: {
          cacheReadInputTokens: 40,
          cacheCreationInputTokens: 20,
          cacheCreation: { ephemeral_5m_input_tokens: 15, ephemeral_1h_input_tokens: 5 },
        },
      } as ProviderMetadata,
    },
    {
      name: 'Google providerMetadata',
      usage: { inputTokens: 100, outputTokens: 30, reasoningTokens: 10 },
      providerMetadata: {
        google: { usageMetadata: { cachedContentTokenCount: 25, thoughtsTokenCount: 10 } },
      } as ProviderMetadata,
    },
    {
      name: 'raw v3 usage',
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        raw: { cache_creation: { ephemeral_5m_input_tokens: 7, ephemeral_1h_input_tokens: 3 } },
      } as LanguageModelUsage,
    },
    {
      name: 'reasoning tokens only',
      usage: { inputTokens: 10, outputTokens: 50, reasoningTokens: 20 },
    },
  ];

  it.each(cases)('$name', ({ usage, providerMetadata }) => {
    expect(extractUsageMetrics(usage, providerMetadata)).toEqual(coreExtractUsageMetrics(usage, providerMetadata));
  });
});
