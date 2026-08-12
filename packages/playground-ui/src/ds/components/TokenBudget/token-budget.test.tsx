// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenBudget } from './token-budget';
import { TokenBudgetDetail } from './token-budget-detail';

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
  it('states the reading and what reaching the threshold sets off', () => {
    const { container } = render(
      <TokenBudgetDetail
        description="Consolidated into a reflection once full"
        label="Observations"
        threshold={8000}
        tokens={5200}
      />,
    );

    expect(screen.getByText('5.2')).not.toBeNull();
    expect(screen.getByText('/8k')).not.toBeNull();
    expect(screen.getByText('Consolidated into a reflection once full')).not.toBeNull();
    expect(container.querySelector('[style*="width: 65%"]')).not.toBeNull();
  });

  it('hatches the slice a pending pass will free rather than spelling it out', () => {
    const { container } = render(
      <TokenBudgetDetail label="Messages" projected={2000} threshold={8000} tokens={5200} />,
    );

    expect(screen.getByText('−2k')).not.toBeNull();
    expect(container.querySelector('.token-budget-hatch')?.getAttribute('style')).toBe('width: 25%;');
    expect(container.querySelector('.bg-current')?.getAttribute('style')).toBe('width: 40%;');
  });
});
