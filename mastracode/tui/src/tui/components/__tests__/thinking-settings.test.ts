import { describe, expect, it } from 'vitest';

import { getThinkingLevelsForModel } from '../thinking-settings.js';

describe('getThinkingLevelsForModel', () => {
  it('includes max for non-OpenAI models', () => {
    const ids = getThinkingLevelsForModel('anthropic/claude-opus-4-6').map(level => level.id);
    expect(ids).toContain('max');
  });

  it('hides max for OpenAI models that top out at xhigh', () => {
    const ids = getThinkingLevelsForModel('openai/gpt-5.3-codex').map(level => level.id);
    expect(ids).not.toContain('max');
    expect(ids).toContain('xhigh');
  });

  it('keeps max for GPT-5.6+ models that support it', () => {
    const ids = getThinkingLevelsForModel('openai/gpt-5.6-codex').map(level => level.id);
    expect(ids).toContain('max');
  });
});
