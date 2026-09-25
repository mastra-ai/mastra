import { describe, expect, it } from 'vitest';

import { readAgentConfig } from '../../src/env.js';

describe('agent configuration', () => {
  it('uses the approved model and bounded per-source timeout defaults', () => {
    expect(readAgentConfig({})).toEqual({
      model: 'openai/gpt-4o-mini',
      timeouts: { identity: 4_000, endpoint: 1_500, cloud: 1_500 },
    });
  });

  it('rejects invalid source budgets', () => {
    expect(() => readAgentConfig({ EVIDENCE_CLOUD_TIMEOUT_MS: '99' })).toThrow('Invalid agent configuration.');
  });
});
