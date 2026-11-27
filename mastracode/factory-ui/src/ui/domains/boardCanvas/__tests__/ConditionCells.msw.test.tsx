import type { RuleCondition, RuleGroup } from '@mastra/factory/rules/rule-group';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CARD_FACTS } from '../../settings/components/conditionFields';
import type { Facts } from '../../settings/components/conditionFields';
import { ConditionCells } from '../components/conditions/ConditionCells';

const POINTS: Facts = {
  type: 'object',
  properties: { item: { type: 'object', title: 'Card', properties: { points: { type: 'number', title: 'Points' } } } },
};

function renderCells({
  rule,
  facts = CARD_FACTS,
  disabled = false,
}: {
  rule?: RuleGroup;
  facts?: Facts;
  disabled?: boolean;
}) {
  const onChange = vi.fn<(rule: RuleGroup | null, unfinished: boolean) => void>();
  render(
    <ConditionCells
      label="Only when"
      rule={rule}
      facts={facts}
      options={{ 'source.repository': [{ value: 'acme/app', label: 'acme/app' }] }}
      disabled={disabled}
      emptyHint="Leave empty to start every card on its own."
      onChange={onChange}
    />,
  );
  return onChange;
}

async function pick(combobox: string, option: string | RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: combobox }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Given no conditions yet', () => {
  it('says what an empty rule means and offers to add one', () => {
    renderCells({});

    expect(screen.getByText('Leave empty to start every card on its own.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add condition' })).toBeInTheDocument();
  });

  it('when a condition is added, then it lists the card facts in order and holds the rule until it is filled in', async () => {
    const user = userEvent.setup();
    const onChange = renderCells({});

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(onChange).toHaveBeenLastCalledWith(null, true);
    expect(screen.getByText('Finish or remove unfinished conditions to save.')).toBeInTheDocument();
    expect(screen.queryByText('Leave empty to start every card on its own.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Field' }));
    const fields = (await screen.findAllByRole('option')).map(option => option.textContent);
    expect(fields.slice(0, 3)).toEqual(['Assignees', 'Author', 'Author trust']);
    await user.click(screen.getByRole('option', { name: 'Title' }));
    await user.type(screen.getByRole('textbox', { name: 'Value' }), 'flaky');

    expect(onChange).toHaveBeenLastCalledWith(
      { operator: 'AND', conditions: [expect.objectContaining({ field: 'item.title', value: 'flaky' })] },
      false,
    );
    expect(screen.queryByText('Finish or remove unfinished conditions to save.')).not.toBeInTheDocument();
  });

  it('when a half-filled condition is removed, then nothing is unfinished any more', async () => {
    const user = userEvent.setup();
    const onChange = renderCells({});

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(screen.getByRole('button', { name: 'Remove condition' }));

    expect(onChange).toHaveBeenLastCalledWith(null, false);
    expect(screen.queryByText('Finish or remove unfinished conditions to save.')).not.toBeInTheDocument();
  });

  it("when the condition tests the repository, then it suggests the project's repositories", async () => {
    const user = userEvent.setup();
    const onChange = renderCells({});

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await pick('Field', 'Repository, team or project');
    await pick('Value', 'acme/app');

    expect(onChange).toHaveBeenLastCalledWith(
      { operator: 'AND', conditions: [expect.objectContaining({ field: 'source.repository', value: 'acme/app' })] },
      false,
    );
  });
});

describe('Given a number condition', () => {
  const rule: RuleGroup = {
    operator: 'AND',
    conditions: [{ field: 'item.points', operator: 'greater_than', value: 3 }],
  };

  it('leaves a cleared number unfinished instead of saving 0', async () => {
    const user = userEvent.setup();
    const onChange = renderCells({ rule, facts: POINTS });

    await user.click(screen.getByRole('button', { name: /^Edit condition/ }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Value' }));

    expect(onChange).toHaveBeenLastCalledWith(null, true);
  });

  it('saves a typed number as a number', async () => {
    const user = userEvent.setup();
    const onChange = renderCells({ rule, facts: POINTS });

    await user.click(screen.getByRole('button', { name: /^Edit condition/ }));
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    await user.clear(value);
    await user.type(value, '5{Enter}');

    expect(onChange).toHaveBeenLastCalledWith(
      { operator: 'AND', conditions: [{ field: 'item.points', operator: 'greater_than', value: 5 }] },
      false,
    );
  });
});

describe('Given a condition on whether a card has a pull request', () => {
  it('picks it as yes or no, without an operator', async () => {
    const user = userEvent.setup();
    renderCells({ rule: { operator: 'AND', conditions: [{ field: 'item.pullRequest', operator: 'not_exists' }] } });

    await user.click(screen.getByRole('button', { name: /^Edit condition/ }));

    expect(screen.getByRole('radio', { name: 'No' })).toBeChecked();
    expect(screen.queryByRole('combobox', { name: 'Operator' })).not.toBeInTheDocument();
  });

  it('keeps a stored pull request number comparison instead of showing it as yes', async () => {
    const user = userEvent.setup();
    renderCells({
      rule: { operator: 'AND', conditions: [{ field: 'item.pullRequest', operator: 'equals', value: 42 }] },
    });

    await user.click(screen.getByRole('button', { name: /^Edit condition/ }));

    expect(screen.queryByRole('radio', { name: 'Yes' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Operator' })).toBeInTheDocument();
  });
});

describe('Given conditions that match any of two', () => {
  const bug: RuleCondition = { field: 'item.labels', operator: 'contains', value: 'bug' };
  const renovate: RuleCondition = { field: 'item.author', operator: 'equals', value: 'renovate' };
  const rule: RuleGroup = { operator: 'OR', conditions: [bug, renovate] };

  it('when switched to all, then a card must match both', async () => {
    const onChange = renderCells({ rule });

    await pick('Match all or any', /^and/);

    expect(onChange).toHaveBeenLastCalledWith({ operator: 'AND', conditions: [bug, renovate] }, false);
  });

  it('when "And" is added to the first, then that pair must hold together and the other stays an alternative', async () => {
    const user = userEvent.setup();
    const onChange = renderCells({ rule });

    await user.click(screen.getByRole('button', { name: /^Edit condition: Labels/ }));
    await user.click(screen.getByRole('button', { name: 'And' }));
    await pick('Field', 'Repository, team or project');
    await pick('Value', 'acme/app');

    expect(onChange).toHaveBeenLastCalledWith(
      {
        operator: 'OR',
        conditions: [
          {
            operator: 'AND',
            conditions: [bug, expect.objectContaining({ field: 'source.repository', value: 'acme/app' })],
          },
          renovate,
        ],
      },
      false,
    );
  });
});

describe('Given a view-only rule', () => {
  it('shows its conditions and how they join without anything to change them', () => {
    renderCells({
      rule: {
        operator: 'OR',
        conditions: [
          { field: 'item.labels', operator: 'contains', value: 'bug' },
          { field: 'item.author', operator: 'equals', value: 'renovate' },
        ],
      },
      disabled: true,
    });

    expect(screen.getByRole('group', { name: 'Only when' })).toHaveTextContent(/Labels.*bug.*or.*Author.*renovate/);
    expect(screen.queryByRole('button', { name: /Edit condition/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add condition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Match all or any' })).not.toBeInTheDocument();
  });
});
