import { getAISDKLanguageModel } from '@browserbasehq/stagehand';
import { describe, expect, it } from 'vitest';

import { STAGEHAND_MODEL_PROVIDERS } from './types';

/**
 * Stagehand does not export its provider registry, but it names every
 * supported provider in the error it throws for an unknown one. Read the list
 * back from there so this test fails if a Stagehand upgrade adds or removes a
 * provider and our mirrored list goes stale.
 */
function providersReportedByStagehand(): string[] {
  try {
    getAISDKLanguageModel('definitely-not-a-provider', 'some-model', { apiKey: 'test' });
  } catch (err) {
    const match = /supported model providers:\s*(.+)$/.exec(err instanceof Error ? err.message : '');
    if (match?.[1]) return match[1].split(',').map(p => p.trim());
  }
  throw new Error('Stagehand no longer reports its supported providers on an unknown provider');
}

describe('STAGEHAND_MODEL_PROVIDERS', () => {
  it('matches the provider registry Stagehand actually resolves against', () => {
    expect([...STAGEHAND_MODEL_PROVIDERS].sort()).toEqual(providersReportedByStagehand().sort());
  });

  it('resolves a language model for every listed provider', () => {
    for (const provider of STAGEHAND_MODEL_PROVIDERS) {
      // vertex needs real Google credentials to construct, so only assert that
      // it is a recognised provider rather than instantiating it.
      if (provider === 'vertex') continue;
      expect(() => getAISDKLanguageModel(provider, 'some-model', { apiKey: 'test' }), provider).not.toThrow();
    }
  });
});
