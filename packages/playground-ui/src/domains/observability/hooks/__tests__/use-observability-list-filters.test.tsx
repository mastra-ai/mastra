// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useObservabilityListFilters } from '../use-observability-list-filters';
import type { ObservabilityListUrlState } from '../use-observability-list-filters';
import type { TraceDatePreset } from '@/domains/traces/trace-filters';
import { renderWithProviders } from '@/test/render';
import { SearchParamsHost } from '@/test/search-params-host';

function Range({ url, defaultDatePreset }: { url: ObservabilityListUrlState; defaultDatePreset?: TraceDatePreset }) {
  const filters = useObservabilityListFilters(url, { defaultDatePreset });
  return (
    <>
      <output data-testid="preset">{filters.datePreset}</output>
      <output data-testid="applied">{String(filters.filtersApplied)}</output>
      <output data-testid="time-range">{JSON.stringify(filters.timeRange)}</output>
      <button type="button" onClick={() => filters.onDatePresetChange('last-7d')}>
        Last 7 days
      </button>
      <button type="button" onClick={() => filters.onDatePresetChange('last-24h')}>
        Last 24 hours
      </button>
    </>
  );
}

const renderRange = (defaultDatePreset?: TraceDatePreset) =>
  renderWithProviders(
    <SearchParamsHost initial="">{url => <Range url={url} defaultDatePreset={defaultDatePreset} />}</SearchParamsHost>,
  );

const text = (testId: string) => screen.getByTestId(testId).textContent;

/** Advances the clock 1 ms per read, so two reads in one render see different times. */
const tickClockOnEveryRead = () => {
  const RealDate = Date;
  let now = RealDate.parse('2026-06-10T12:00:00.000Z');
  class TickingDate extends RealDate {
    constructor(...args: [] | [number | string | Date]) {
      if (args.length === 0) super(now++);
      else super(args[0]);
    }
    static now() {
      return now++;
    }
  }
  vi.stubGlobal('Date', TickingDate);
};

describe('useObservabilityListFilters', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the last 7 days by default and leaves that preset out of the URL', () => {
    renderRange();
    expect(text('preset')).toBe('last-7d');
    expect(text('applied')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Last 24 hours' }));
    expect(text('search-params')).toBe('datePreset=last-24h');

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(text('search-params')).toBe('');
  });

  it('queries exactly the last 24 hours even when the clock moves while the range is resolved', () => {
    renderRange();
    tickClockOnEveryRead();

    fireEvent.click(screen.getByRole('button', { name: 'Last 24 hours' }));

    const { from, to } = JSON.parse(text('time-range') ?? '{}');
    expect(Date.parse(to) - Date.parse(from)).toBe(24 * 60 * 60 * 1000);
  });

  describe('when the host defaults to another range', () => {
    it('shows that range for a URL without one, as no filter', () => {
      renderRange('last-24h');
      expect(text('preset')).toBe('last-24h');
      expect(text('applied')).toBe('false');
    });

    it('writes the last 7 days to the URL and leaves the host default out', () => {
      renderRange('last-24h');

      fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      expect(text('search-params')).toBe('datePreset=last-7d');
      expect(text('preset')).toBe('last-7d');
      expect(text('applied')).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: 'Last 24 hours' }));
      expect(text('search-params')).toBe('');
      expect(text('preset')).toBe('last-24h');
    });
  });
});
