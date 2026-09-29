import type { GetScorerResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScorersList } from '../scorers-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const scorer = (name: string): GetScorerResponse =>
  ({
    scorer: { config: { id: name, name, description: `${name} description` } },
    source: 'code',
    agentIds: [],
    workflowIds: [],
  }) as unknown as GetScorerResponse;

const scorers = {
  'scorer-a': scorer('Scorer A'),
  'scorer-b': scorer('Scorer B'),
};

describe('ScorersList', () => {
  describe('when onSelectScorer is provided', () => {
    it('renders rows as buttons and calls onSelectScorer with the scorer', () => {
      const onSelectScorer = vi.fn();
      renderWithProviders(
        <TestLinkProvider>
          <ScorersList scorers={scorers} isLoading={false} onSelectScorer={onSelectScorer} keyboardGlobal={false} />
        </TestLinkProvider>,
      );

      const rows = interactiveRows();
      expect(rows).toHaveLength(2);
      expect(rows.every(row => row.tagName === 'BUTTON')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: /Scorer B/ }));
      expect(onSelectScorer).toHaveBeenCalledWith(expect.objectContaining({ id: 'scorer-b' }));
    });

    it('marks the selected scorer row as featured', () => {
      renderWithProviders(
        <TestLinkProvider>
          <ScorersList scorers={scorers} isLoading={false} onSelectScorer={() => {}} selectedScorerId="scorer-a" />
        </TestLinkProvider>,
      );

      const [first, second] = interactiveRows();
      expect(first?.dataset.featured).toBe('true');
      expect(second?.dataset.featured).toBeUndefined();
    });
  });
});
