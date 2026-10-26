import { describe, expect, it } from 'vitest';

import { opencodeClaudeMaxProvider } from '../claude-max.js';

describe('Claude Max default model', () => {
  it('uses the current Sonnet model when no model ID is supplied (#27467)', () => {
    expect(opencodeClaudeMaxProvider().modelId).toBe('claude-sonnet-5-5');
  });

  it('honors an explicitly selected model', () => {
    expect(opencodeClaudeMaxProvider('claude-opus-4-6').modelId).toBe('claude-opus-4-6');
  });
});
