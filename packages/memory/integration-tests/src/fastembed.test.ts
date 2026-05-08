import { describe } from 'vitest';

import { getFastembedTests } from './shared/fastembed';

// V3 Tests (AI SDK v6)
describe('FastEmbed V3 Tests', () => {
  getFastembedTests({
    version: 'v3',
  });
});

// V2 Tests (AI SDK v5)
describe('FastEmbed V2 Tests', () => {
  getFastembedTests({
    version: 'v2',
  });
});

// V1 Tests (AI SDK v4 legacy)
describe('FastEmbed V1 Legacy Tests', () => {
  getFastembedTests({
    version: 'v1',
  });
});
