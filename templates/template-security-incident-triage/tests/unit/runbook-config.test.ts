import { describe, expect, it } from 'vitest';

import { readRunbookConfig } from '../../src/mastra/knowledge/config.js';

describe('runbook configuration', () => {
  it('uses an explicit local cache path and rejects empty or excessive values', () => {
    expect(readRunbookConfig({}).fastembedCacheDir).toBe('.cache/fastembed');
    expect(readRunbookConfig({ RUNBOOK_FASTEMBED_CACHE_DIR: '/tmp/runbook-model' }).fastembedCacheDir).toBe(
      '/tmp/runbook-model',
    );
    expect(() => readRunbookConfig({ RUNBOOK_FASTEMBED_CACHE_DIR: ' ' })).toThrow(
      'Invalid runbook knowledge configuration.',
    );
    expect(() => readRunbookConfig({ RUNBOOK_FASTEMBED_CACHE_DIR: 'a'.repeat(1_025) })).toThrow(
      'Invalid runbook knowledge configuration.',
    );
  });
});
