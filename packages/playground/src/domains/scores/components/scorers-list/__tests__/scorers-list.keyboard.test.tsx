import type { GetScorerResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { ScorersList } from '../scorers-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
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
  'scorer-c': scorer('Scorer C'),
};

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ScorersList scorers={scorers} isLoading={false} />
    </TestLinkProvider>,
  );

describe('ScorersList keyboard navigation', () => {
  it('applies a roving tabindex to scorer rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });
});
