// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricsLineChart } from './metrics-line-chart';
import { useFixedChartSize } from '@/test/chart-size';

const data = ['1 PM', '2 PM', '3 PM', '4 PM'].map((time, i) => ({ time, tsMs: i * 3_600_000, value: i + 1 }));
const series = [{ dataKey: 'value', label: 'vCPU-hours', color: 'green' }];

const renderChart = () => {
  const view = render(
    <>
      <MetricsLineChart data={data} series={series} showYAxis={false} />
      <button type="button">elsewhere</button>
    </>,
  );
  const wrapper = view.container.querySelector('.recharts-wrapper');
  if (!wrapper) throw new Error('chart did not render');
  return { ...view, wrapper };
};

const tooltip = () => document.body.querySelector('[data-slot="chart-tooltip-portal"]');

const nextFrame = () => act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));

/** Recharts applies pointer moves on the next animation frame. */
const hover = async (wrapper: Element, clientX = 300) => {
  fireEvent.mouseMove(wrapper, { clientX, clientY: 20 });
  await nextFrame();
};

describe('MetricsLineChart tooltip', () => {
  useFixedChartSize(600, 300);

  // On touch there's no mouseleave, and the tooltip is fixed to the window: it would float over the page.
  it('hides when the page scrolls, and comes back when the chart is touched again', async () => {
    const { wrapper } = renderChart();
    await hover(wrapper);
    expect(tooltip()?.textContent).toContain('vCPU-hours');

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(tooltip()).toBeNull();

    fireEvent.pointerDown(wrapper);
    expect(tooltip()).not.toBeNull();
  });

  it('hides when a scrollable ancestor scrolls', async () => {
    const { wrapper, container } = renderChart();
    await hover(wrapper);

    fireEvent.scroll(container);
    expect(tooltip()).toBeNull();
  });

  it('hides on a press outside the chart', async () => {
    const { wrapper, getByRole } = renderChart();
    await hover(wrapper);

    fireEvent.pointerDown(getByRole('button', { name: 'elsewhere' }));
    expect(tooltip()).toBeNull();

    fireEvent.pointerMove(wrapper);
    expect(tooltip()).not.toBeNull();
  });

  it('comes back on arrow-key navigation after a scroll', async () => {
    const { wrapper } = renderChart();
    const surface = wrapper.querySelector<SVGElement>('.recharts-surface');
    if (!surface) throw new Error('chart surface did not render');
    act(() => {
      surface.focus();
    });
    await nextFrame();
    expect(tooltip()?.textContent).toContain('1 PM');

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(tooltip()).toBeNull();

    fireEvent.keyDown(surface, { key: 'Shift' });
    await nextFrame();
    expect(tooltip()).toBeNull();

    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    await nextFrame();
    await nextFrame();
    expect(tooltip()?.textContent).toContain('2 PM');
  });
});
