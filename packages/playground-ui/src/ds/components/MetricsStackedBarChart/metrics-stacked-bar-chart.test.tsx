// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MetricsStackedBarChart } from './metrics-stacked-bar-chart';
import { useFixedChartSize } from '@/test/chart-size';

// Four columns over a 600px plot with no y-axis: each column owns 150px.
const COLUMN_CENTERS = [75, 225, 375, 525];
const data = ['1 PM', '2 PM', '3 PM', '4 PM'].map((label, i) => ({ label, ts: i * 3_600_000, ok: i + 1, errors: 1 }));
const series = [
  { dataKey: 'ok', label: 'Traces', color: 'gray' },
  { dataKey: 'errors', label: 'Errors', color: 'red' },
];

const renderChart = (props: Partial<Parameters<typeof MetricsStackedBarChart>[0]> = {}) => {
  const view = render(
    <MetricsStackedBarChart data={data} series={series} xKey="label" timestampKey="ts" showYAxis={false} {...props} />,
  );
  const wrapper = view.container.querySelector('.recharts-wrapper');
  if (!wrapper) throw new Error('chart did not render');
  return { ...view, wrapper };
};

const at = (column: number) => ({ clientX: COLUMN_CENTERS[column], clientY: 20 });

/** Recharts applies pointer moves on the next animation frame. */
const moveTo = async (wrapper: Element, column: number) => {
  fireEvent.mouseMove(wrapper, at(column));
  await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
};

const drag = async (wrapper: Element, from: number, to: number) => {
  await moveTo(wrapper, from);
  fireEvent.mouseDown(wrapper, at(from));
  await moveTo(wrapper, to);
};

const dimmedColumns = (container: HTMLElement) => {
  const columns = [...container.querySelectorAll('[data-bucket]')];
  const dimmed = columns.filter(column => getComputedStyle(column).opacity !== '1' && getComputedStyle(column).opacity);
  return [...new Set(dimmed.map(column => Number(column.getAttribute('data-bucket'))))].sort();
};

describe('MetricsStackedBarChart tooltip', () => {
  useFixedChartSize(600, 300);

  // A short chart in a clipping container (like the observability histogram above a list) would cut it off.
  it('renders outside the chart, so a clipping container cannot cut it off', async () => {
    const { wrapper, container } = renderChart();

    await moveTo(wrapper, 2);

    const tooltip = [...document.body.querySelectorAll('[data-slot="chart-tooltip-portal"]')];
    expect(tooltip).toHaveLength(1);
    expect(tooltip[0]?.textContent).toContain('3 PM');
    expect(container.contains(tooltip[0] ?? null)).toBe(false);
    expect(tooltip[0]?.classList.contains('fixed')).toBe(true);

    fireEvent.mouseLeave(wrapper);
    await act(() => new Promise(requestAnimationFrame));
    expect(document.body.querySelector('[data-slot="chart-tooltip-portal"]')).toBeNull();
  });
});

describe('MetricsStackedBarChart zoom', () => {
  useFixedChartSize(600, 300);

  describe('when the user drags across columns', () => {
    it('reports the first and last column of the drag', async () => {
      const onZoom = vi.fn();
      const { wrapper } = renderChart({ onZoom });

      await drag(wrapper, 1, 2);
      await moveTo(wrapper, 3);
      fireEvent.mouseUp(wrapper, at(3));

      expect(onZoom).toHaveBeenCalledTimes(1);
      expect(onZoom).toHaveBeenCalledWith({ start: 1, end: 3 });
    });

    it('orders the range when dragging right to left', async () => {
      const onZoom = vi.fn();
      const { wrapper } = renderChart({ onZoom });

      await drag(wrapper, 3, 0);
      fireEvent.mouseUp(wrapper, at(0));

      expect(onZoom).toHaveBeenCalledWith({ start: 0, end: 3 });
    });

    it('dims the columns outside the selection while dragging, and clears it on release', async () => {
      const { wrapper, container } = renderChart({ onZoom: vi.fn() });

      await drag(wrapper, 1, 2);
      expect(dimmedColumns(container)).toEqual([0, 3]);

      fireEvent.mouseUp(wrapper, at(2));
      fireEvent.mouseLeave(wrapper);
      expect(dimmedColumns(container)).toEqual([]);
    });

    it('shades the dragged columns, even empty ones, and clears the shade on release', async () => {
      const empty = data.map(row => ({ ...row, ok: 0, errors: 0 }));
      const { wrapper, container } = renderChart({ data: empty, onZoom: vi.fn() });
      const selection = () => container.querySelector('[data-slot="chart-drag-selection"]');

      await drag(wrapper, 2, 1);
      expect(selection()?.getAttribute('x')).toBe('150');
      expect(selection()?.getAttribute('width')).toBe('300');

      fireEvent.mouseUp(wrapper, at(1));
      expect(selection()).toBeNull();
    });

    it('still zooms when the pointer is released outside the chart', async () => {
      const onZoom = vi.fn();
      const { wrapper } = renderChart({ onZoom });

      await drag(wrapper, 0, 2);
      fireEvent.mouseLeave(wrapper);
      fireEvent.mouseUp(window);

      expect(onZoom).toHaveBeenCalledWith({ start: 0, end: 2 });
    });

    it('does not also click the column under the pointer', async () => {
      const onBucketClick = vi.fn();
      const { wrapper } = renderChart({ onZoom: vi.fn(), onBucketClick });

      await drag(wrapper, 0, 2);
      fireEvent.mouseUp(wrapper, at(2));
      fireEvent.click(wrapper, at(2));

      expect(onBucketClick).not.toHaveBeenCalled();
    });
  });

  describe('when the user presses and releases on one column', () => {
    it('does not zoom, and keeps the column click', async () => {
      const onZoom = vi.fn();
      const onBucketClick = vi.fn();
      const { wrapper } = renderChart({ onZoom, onBucketClick });

      await moveTo(wrapper, 2);
      fireEvent.mouseDown(wrapper, at(2));
      fireEvent.mouseUp(wrapper, at(2));
      fireEvent.click(wrapper, at(2));

      expect(onZoom).not.toHaveBeenCalled();
      expect(onBucketClick).toHaveBeenCalledWith(data[2], 2);
    });
  });

  describe('when the chart does not opt in', () => {
    it('ignores drags', async () => {
      const onBucketClick = vi.fn();
      const { wrapper, container } = renderChart({ onBucketClick });

      await drag(wrapper, 0, 3);
      fireEvent.mouseUp(wrapper, at(3));
      fireEvent.mouseLeave(wrapper);

      expect(dimmedColumns(container)).toEqual([]);
      expect(container.querySelector('[data-slot="chart-drag-selection"]')).toBeNull();
    });
  });
});
