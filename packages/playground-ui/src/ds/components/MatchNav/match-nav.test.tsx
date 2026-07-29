// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { MatchNav } from './match-nav';

afterEach(() => {
  cleanup();
});

function renderNav(props: Partial<React.ComponentProps<typeof MatchNav>> = {}) {
  render(
    <TooltipProvider>
      <MatchNav current={1} total={3} {...props} />
    </TooltipProvider>,
  );
}

describe('MatchNav', () => {
  it('shows the current/total counter', () => {
    renderNav({ current: 2, total: 12 });
    expect(screen.getByText('2/12')).toBeTruthy();
  });

  it('shows "0/0" and disables both buttons when there are no matches', () => {
    renderNav({ current: 0, total: 0 });
    expect(screen.getByText('0/0')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next match' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Previous match' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fires onNext and onPrevious from the buttons', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    renderNav({ onNext, onPrevious });

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('renders non-submitting buttons so form-backed usages are safe', () => {
    renderNav();
    expect(screen.getByRole('button', { name: 'Next match' }).getAttribute('type')).toBe('button');
    expect(screen.getByRole('button', { name: 'Previous match' }).getAttribute('type')).toBe('button');
  });

  it('caps displayed values at 999+ while the aria-label keeps the real counts', () => {
    renderNav({ current: 2841, total: 2841 });
    expect(screen.getByText('999+/999+')).toBeTruthy();
    expect(screen.getByLabelText('2841 of 2841 matches')).toBeTruthy();
  });

  it('only caps the values that exceed the limit', () => {
    renderNav({ current: 5, total: 1200 });
    expect(screen.getByText('5/999+')).toBeTruthy();
  });
});
