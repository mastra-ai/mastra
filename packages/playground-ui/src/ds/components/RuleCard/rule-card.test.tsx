// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuleCard, RuleCardDragHandle, RuleCardHeader, RuleCardOutcome, RuleCardTitleInput } from './rule-card';

afterEach(() => {
  cleanup();
});

describe('RuleCard', () => {
  it('marks a switched-off rule as inactive and leaves an active one unmarked', () => {
    render(
      <>
        <RuleCard data-testid="off" inactive />
        <RuleCard data-testid="on" />
      </>,
    );

    expect(screen.getByTestId('off').getAttribute('data-inactive')).toBe('true');
    expect(screen.getByTestId('on').hasAttribute('data-inactive')).toBe(false);
  });

  it('keeps an inactive rule editable', () => {
    const onChange = vi.fn();
    render(
      <RuleCard inactive>
        <RuleCardHeader>
          <RuleCardTitleInput aria-label="Route name" defaultValue="Bugs" onChange={onChange} />
        </RuleCardHeader>
      </RuleCard>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Route name' }), { target: { value: 'Bug reports' } });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('names the drag handle after the rule it moves', () => {
    render(
      <RuleCardHeader>
        <RuleCardDragHandle aria-label="Reorder Bugs" />
      </RuleCardHeader>,
    );

    expect(screen.getByRole('button', { name: 'Reorder Bugs' })).toBeTruthy();
  });

  it('puts the outcome label before its pickers', () => {
    render(
      <RuleCardOutcome label="Send to" data-testid="outcome">
        <button type="button">Work</button>
      </RuleCardOutcome>,
    );

    expect(screen.getByTestId('outcome').textContent).toBe('Send toWork');
  });
});
