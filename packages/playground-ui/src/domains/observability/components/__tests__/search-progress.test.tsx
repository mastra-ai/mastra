// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservabilityHistogram } from '../observability-histogram';
import { SearchProgress } from '../search-progress';
import type { HistogramBucket } from '@/domains/observability/lib/histogram-buckets';

const requestedRange = { from: '2026-09-21T00:00:00.000Z', to: '2026-10-21T00:00:00.000Z' };

afterEach(cleanup);

describe('SearchProgress', () => {
  describe('when a newest-first search is part way through', () => {
    it('says how much of the range is searched and stops on Stop', async () => {
      const onStop = vi.fn();
      render(
        <SearchProgress
          requestedRange={requestedRange}
          searchedRange={{ from: '2026-10-07T00:00:00.000Z', to: requestedRange.to }}
          searching
          stopped={false}
          onStop={onStop}
          onContinue={vi.fn()}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('Searched the last 14 of 30 days…');
      await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
      expect(onStop).toHaveBeenCalledOnce();
    });
  });

  describe('when an oldest-first search was stopped', () => {
    it('says where it stopped and continues on Continue', async () => {
      const onContinue = vi.fn();
      render(
        <SearchProgress
          requestedRange={requestedRange}
          searchedRange={{ from: requestedRange.from, to: '2026-09-28T00:00:00.000Z' }}
          searching
          stopped
          onStop={vi.fn()}
          onContinue={onContinue}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('Stopped after the first 7 of 30 days.');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(onContinue).toHaveBeenCalledOnce();
    });
  });

  describe('when the whole range is searched', () => {
    it('says so, without a button', () => {
      render(
        <SearchProgress
          requestedRange={requestedRange}
          searchedRange={requestedRange}
          searching={false}
          stopped={false}
          onStop={vi.fn()}
          onContinue={vi.fn()}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('Searched all 30 days.');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});

const DAY = 24 * 60 * 60 * 1000;
const buckets: HistogramBucket[] = Array.from({ length: 10 }, (_, i) => ({
  ts: Date.parse('2026-10-11T00:00:00.000Z') + i * DAY,
  label: `Oct ${11 + i}`,
  edgeLabel: `Oct ${11 + i}`,
  time: `Oct ${11 + i}`,
  ok: i >= 6 ? 3 : 0,
  errors: 0,
}));

describe('ObservabilityHistogram', () => {
  describe('when a search has not reached the oldest bars', () => {
    it('covers the bars before the searched range with a pending band', () => {
      render(
        <ObservabilityHistogram
          label="Spans over time"
          resourceLabel="Spans"
          buckets={buckets}
          pendingBefore={new Date('2026-10-17T00:00:00.000Z')}
        />,
      );

      expect(screen.getByTestId('histogram-pending-band').style.width).toBe('60%');
    });
  });

  describe('when the whole range is searched', () => {
    it('draws no pending band', () => {
      render(<ObservabilityHistogram label="Spans over time" resourceLabel="Spans" buckets={buckets} />);

      expect(screen.queryByTestId('histogram-pending-band')).toBeNull();
    });
  });
});

describe('SearchProgress after a failed chunk', () => {
  it('keeps what was searched and offers to try again', async () => {
    const onContinue = vi.fn();
    render(
      <SearchProgress
        requestedRange={requestedRange}
        searchedRange={{ from: '2026-10-14T00:00:00.000Z', to: requestedRange.to }}
        searching
        stopped={false}
        failed
        onStop={vi.fn()}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe("Couldn't search past the last 7 of 30 days.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
