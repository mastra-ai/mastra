import { TokenMetrics as CoreTokenMetrics } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { TokenMetrics } from './types';

describe('TokenMetrics', () => {
  it('matches the copy in @mastra/core/observability', () => {
    expect(TokenMetrics).toEqual(CoreTokenMetrics);
  });
});
