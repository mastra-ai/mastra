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

    expect(container.querySelector('.token-budget-arc')?.getAttribute('stroke-dasharray')).toBe('21.99 43.98');
  });

  it('caps the ring at full rather than overflowing past the threshold', () => {
    const { container } = render(<TokenBudget label="Message window" threshold={30_000} tokens={44_000} />);

    expect(container.querySelector('.token-budget-arc')?.getAttribute('stroke-dasharray')).toBe('43.98 43.98');
  });

  it.each([
    ['messages', 'text-blue-500'],
    ['memory', 'text-violet-500'],
    ['warning', 'text-warning1'],
  ] as const)('colours a %s budget with its own tone', (tone, expected) => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={1} tone={tone} />);

    expect(screen.getByRole('meter', { name: 'Message window' }).className).toContain(expected);
  });

  it('reads as a messages budget unless told otherwise', () => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={1} />);

    expect(screen.getByRole('meter', { name: 'Message window' }).className).toContain('text-blue-500');
  });

  it('reports a value the meter can actually hold', () => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={44_000} />);

    const meter = screen.getByRole('meter', { name: 'Message window' });
    // Over budget still reports full, never past aria-valuemax.
    expect(meter.getAttribute('aria-valuenow')).toBe('30000');
    expect(meter.getAttribute('aria-valuemax')).toBe('30000');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
  });

  it('leaves the ring empty when there is no budget to fill', () => {
    const { container } = render(<TokenBudget label="Message window" threshold={0} tokens={5_000} />);

    expect(container.querySelector('.token-budget-arc')?.getAttribute('stroke-dasharray')).toBe('0.00 43.98');
  });

  it('keeps a caller class alongside its own', () => {
    render(<TokenBudget label="Message window" threshold={30_000} tokens={1} className="my-own-class" />);

    const meter = screen.getByRole('meter', { name: 'Message window' });
    expect(meter.className).toContain('my-own-class');
    expect(meter.className).toContain('tabular-nums');
  });

  it('points the working sheen at its own gradient and mask', () => {
    const { container } = render(<TokenBudget label="Observations" threshold={8000} tokens={5200} working />);

    const gradientId = container.querySelector('linearGradient')?.getAttribute('id');
    const maskId = container.querySelector('mask')?.getAttribute('id');

    expect(gradientId).toBeTruthy();
    expect(maskId).toBeTruthy();
    expect(gradientId).not.toBe(maskId);
    expect(container.querySelector('.token-budget-sheen')?.getAttribute('fill')).toBe(`url(#${gradientId})`);
    expect(container.querySelector('g')?.getAttribute('mask')).toBe(`url(#${maskId})`);
  });

  it('keeps two budgets on one screen from sharing a mask', () => {
    const { container } = render(
      <>
        <TokenBudget label="Messages" threshold={8000} tokens={5200} working />
        <TokenBudget label="Observations" threshold={8000} tokens={1200} working />
      </>,
    );

    const maskIds = [...container.querySelectorAll('mask')].map(mask => mask.getAttribute('id'));
    expect(maskIds).toHaveLength(2);
    expect(new Set(maskIds).size).toBe(2);
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
