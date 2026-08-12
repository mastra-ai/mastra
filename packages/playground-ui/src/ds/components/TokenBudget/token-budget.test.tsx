// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenBudgetDetail } from './token-budget-detail';
import { TokenBudget } from './token-budget';

afterEach(() => {
  cleanup();
});

describe('TokenBudget', () => {
  it('keeps the reading on screen and speaks the budget behind it', () => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={14_900} />);

    expect(screen.getByRole('meter', { name: 'Message window' }).getAttribute('aria-valuetext')).toBe('14.9/30k');
    expect(screen.getByText('14.9')).not.toBeNull();
    expect(screen.getByText('/30k')).not.toBeNull();
  });

  it('fills the ring to the share of the threshold that is used', () => {
    const { container } = render(<TokenBudget label="Message window" threshold={30_000} tokens={14_900} />);

    expect(container.querySelector('.token-budget-dial')?.getAttribute('style')).toContain('--token-budget-fill: 50');
  });

  it('caps the ring at full rather than overflowing past the threshold', () => {
    const { container } = render(<TokenBudget label="Message window" threshold={30_000} tokens={44_000} />);

    expect(container.querySelector('.token-budget-dial')?.getAttribute('style')).toContain('--token-budget-fill: 100');
  });

  it('marks the ring as working only while work runs against the budget', () => {
    const { container, rerender } = render(<TokenBudget label="Observations" threshold={8000} tokens={5200} />);

    expect(container.querySelector('[data-working]')).toBeNull();

    rerender(<TokenBudget label="Observations" threshold={8000} tokens={5200} working />);

    expect(container.querySelector('[data-working]')).not.toBeNull();
  });
});

describe('TokenBudgetDetail', () => {
  it('states the reading and what filling the budget up does', () => {
    const { container } = render(
      <TokenBudgetDetail
        description="Observations are consolidated when it fills."
        hint="The pending pass frees 1.2k."
        label="Observations"
        threshold={8000}
        tokens={5200}
      />,
    );

    expect(screen.getByText('5.2/8k')).not.toBeNull();
    expect(screen.getByText('Observations are consolidated when it fills.')).not.toBeNull();
    expect(screen.getByText('The pending pass frees 1.2k.')).not.toBeNull();
    expect(container.querySelector('[style*="width: 65%"]')).not.toBeNull();
  });
});
