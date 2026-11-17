import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { describe, expect, it, vi } from 'vitest';

import { ConditionRows } from '../ConditionRows';
import type { Facts } from '../conditionFields';

const facts: Facts = {
  type: 'object',
  properties: { item: { type: 'object', title: 'Card', properties: { points: { type: 'number', title: 'Points' } } } },
};

function renderRows(rule: RuleGroup) {
  const onChange = vi.fn<(rule: RuleGroup | null, incomplete: boolean) => void>();
  render(<ConditionRows label="Conditions" rule={rule} facts={facts} onChange={onChange} />);
  return onChange;
}

describe('ConditionRows number values', () => {
  it('leaves a cleared number unfinished instead of saving 0', async () => {
    const user = userEvent.setup();
    const onChange = renderRows({
      operator: 'AND',
      conditions: [{ field: 'item.points', operator: 'greater_than', value: 3 }],
    });

    await user.clear(screen.getByLabelText('Value'));
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(null, true);
  });

  it('saves a typed number as a number', async () => {
    const user = userEvent.setup();
    const onChange = renderRows({
      operator: 'AND',
      conditions: [{ field: 'item.points', operator: 'greater_than', value: 3 }],
    });

    await user.clear(screen.getByLabelText('Value'));
    await user.type(screen.getByLabelText('Value'), '5{Enter}');

    expect(onChange).toHaveBeenLastCalledWith(
      { operator: 'AND', conditions: [{ field: 'item.points', operator: 'greater_than', value: 5 }] },
      false,
    );
  });
});

describe('ConditionRows presence values', () => {
  const pullRequestFacts: Facts = {
    type: 'object',
    properties: {
      item: { type: 'object', title: 'Card', properties: { pullRequest: { type: 'number', title: 'Pull request' } } },
    },
  };

  function renderPullRequest(rule: RuleGroup) {
    render(<ConditionRows label="Conditions" rule={rule} facts={pullRequestFacts} onChange={vi.fn()} />);
  }

  it('picks whether a card has a pull request as yes or no', () => {
    renderPullRequest({ operator: 'AND', conditions: [{ field: 'item.pullRequest', operator: 'not_exists' }] });

    expect(screen.getByRole('radio', { name: 'No' })).toBeChecked();
    expect(screen.queryByLabelText('Operator')).not.toBeInTheDocument();
  });

  it('keeps a stored pull request number comparison instead of showing it as yes', () => {
    renderPullRequest({ operator: 'AND', conditions: [{ field: 'item.pullRequest', operator: 'equals', value: 42 }] });

    expect(screen.queryByRole('radio', { name: 'Yes' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Operator')).toBeInTheDocument();
  });
});
