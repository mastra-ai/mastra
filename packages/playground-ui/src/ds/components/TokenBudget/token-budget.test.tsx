// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenBudget } from './token-budget';

afterEach(() => {
  cleanup();
});

describe('TokenBudget', () => {
  it('keeps the digits on screen and speaks the budget behind them', () => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={14_900} />);

    expect(screen.getByRole('meter', { name: 'Message window' }).getAttribute('aria-valuetext')).toBe('14.9/30k');
    expect(screen.getByText('14.9')).not.toBeNull();
    expect(screen.getByText('/30k')).not.toBeNull();
  });

  it('opens the reading and what the budget does when clicked', async () => {
    render(
      <TokenBudget
        description="Observations are consolidated when it fills."
        label="Observations"
        threshold={8000}
        tokens={5200}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText('5.2/8k tokens · 65%')).not.toBeNull());
    expect(screen.getByText('Observations are consolidated when it fills.')).not.toBeNull();
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
