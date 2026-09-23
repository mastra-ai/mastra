// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoTracesInfo } from '../no-traces-info';

afterEach(cleanup);

describe('NoTracesInfo', () => {
  it('keeps initial collection guidance separate from date-filter guidance', () => {
    const { container, rerender } = render(<NoTracesInfo datePreset="all" />);

    expect(screen.getByRole('heading', { name: 'No traces yet' })).toBeTruthy();
    expect(screen.getByText('Traces will appear here once agents, workflows, or tools are executed.')).toBeTruthy();
    expect(container.querySelector('svg.lucide-circle-slash')).toBeTruthy();

    rerender(<NoTracesInfo datePreset="last-24h" />);

    expect(screen.getByRole('heading', { name: 'No traces for the last 24 hours' })).toBeTruthy();
    expect(
      screen.getByText('Pick a wider time range — older traces may fall outside the current window.'),
    ).toBeTruthy();
    expect(screen.queryByText('No traces yet')).toBeNull();
    expect(container.querySelector('svg.lucide-circle-slash')).toBeTruthy();
  });

  it('preserves explicit dates in the custom-range empty state', () => {
    render(
      <NoTracesInfo datePreset="custom" dateFrom={new Date(2026, 8, 1, 9, 0)} dateTo={new Date(2026, 8, 7, 18, 0)} />,
    );

    expect(
      screen.getByRole('heading', { name: 'No traces between Sep 1, 2026 09:00 and Sep 7, 2026 18:00' }),
    ).toBeTruthy();
  });
});
