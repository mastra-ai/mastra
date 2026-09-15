import { describe, expect, it } from 'vitest';
import { getAgentSuggestedPrompts } from '../agent-suggested-prompts';

describe('getAgentSuggestedPrompts', () => {
  describe('when suggested prompts are missing or malformed', () => {
    it('returns no prompts', () => {
      expect(getAgentSuggestedPrompts(undefined)).toEqual([]);
      expect(getAgentSuggestedPrompts({ suggestedPrompts: 'Check the weather' })).toEqual([]);
    });
  });

  describe('when suggested prompts contain invalid and duplicate values', () => {
    it('returns the first three unique non-empty strings', () => {
      const metadata = {
        suggestedPrompts: [
          '  Check the weather  ',
          '',
          42,
          'Check the weather',
          'Check a stock',
          null,
          'Build a page',
          'Ignored after the limit',
        ],
      };

      expect(getAgentSuggestedPrompts(metadata)).toEqual(['Check the weather', 'Check a stock', 'Build a page']);
    });
  });
});
