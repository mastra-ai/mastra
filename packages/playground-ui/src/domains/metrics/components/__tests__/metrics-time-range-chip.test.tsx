// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TRACE_TIME_RANGE_FIELD, TRACE_TIME_RANGE_ITEM } from '../../../traces/components/trace-time-range-chip';
import { MetricsProvider } from '../../hooks/use-metrics';
import { METRICS_FILTER_BAR_OPERATORS } from '../../metrics-filters';
import { MetricsTimeRangeChip } from '../metrics-time-range-chip';
import { olderServerCapabilities, traceAggregateCapabilities } from './fixtures/trace-aggregate';
import { serveCapabilities } from './metrics-msw';
import { FilterBar } from '@/ds/components/FilterBar';
import { renderWithProviders } from '@/test/render';

const DAY = 24 * 60 * 60 * 1000;

function renderChip(onCustomRangeChange = vi.fn()) {
  const from = new Date(Date.now() - 30 * DAY);
  renderWithProviders(
    <MetricsProvider
      preset="custom"
      customRange={{ from, to: new Date() }}
      filterTokens={[]}
      onPresetChange={() => {}}
      onFilterTokensChange={() => {}}
      onCustomRangeChange={onCustomRangeChange}
    >
      <FilterBar
        fields={[TRACE_TIME_RANGE_FIELD]}
        operators={METRICS_FILTER_BAR_OPERATORS}
        value={[TRACE_TIME_RANGE_ITEM]}
        onValueChange={() => {}}
        aria-label="Metrics filters"
      >
        <FilterBar.Chips renderChip={() => <MetricsTimeRangeChip />} />
      </FilterBar>
    </MetricsProvider>,
  );
  return onCustomRangeChange;
}

describe('MetricsTimeRangeChip', () => {
  describe('when the trace store keeps 7 days', () => {
    it('rejects a custom range that starts before the oldest kept day', async () => {
      serveCapabilities({
        ...traceAggregateCapabilities,
        capabilities: { ...traceAggregateCapabilities.capabilities, traceRetentionDays: 7 },
      });
      const onCustomRangeChange = renderChip();

      fireEvent.click(screen.getByRole('button', { name: /last|custom|time|\d/i }));
      // The chip only knows the limit once capabilities load; then the 30-days-ago start day is disabled.
      const startDay = String(new Date(Date.now() - 30 * DAY).getDate());
      await vi.waitFor(() =>
        expect(screen.getAllByRole('gridcell', { name: startDay }).some(day => day.hasAttribute('disabled'))).toBe(
          true,
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByRole('alert').textContent).toContain('Range cannot start before');
      expect(onCustomRangeChange).not.toHaveBeenCalled();
    });
  });

  describe('when the store reports no retention limit', () => {
    it('applies the same range', async () => {
      serveCapabilities(olderServerCapabilities);
      const onCustomRangeChange = renderChip();

      fireEvent.click(screen.getByRole('button', { name: /last|custom|time|\d/i }));
      fireEvent.click(await screen.findByRole('button', { name: /apply/i }));

      expect(screen.queryByRole('alert')).toBeNull();
      expect(onCustomRangeChange).toHaveBeenCalledTimes(1);
    });
  });
});
