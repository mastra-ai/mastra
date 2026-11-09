// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Bar, ComposedChart, Line, YAxis } from 'recharts';
import { describe, expect, it } from 'vitest';
import { placeTimeTick } from './chart-axes';
import { timeXAxis } from './chart-frame';

describe('placeTimeTick', () => {
  it('pins the last bar label to the right edge of the plot', () => {
    // 10 bands of 30px; the last one is centred at 285.
    expect(placeTimeTick({ x: 285, index: 9, offset: 15, count: 10, plotWidth: 300, textWidth: 76 })).toEqual({
      x: 300,
      anchor: 'end',
    });
  });

  it('pins the first point label to the left edge of the plot', () => {
    expect(placeTimeTick({ x: 20, index: 0, count: 10, plotWidth: 300, textWidth: 76 })).toEqual({
      x: 20,
      anchor: 'start',
    });
  });

  it('pins the last point label to the right edge of the plot', () => {
    expect(placeTimeTick({ x: 320, index: 9, count: 10, plotWidth: 300, textWidth: 76 })).toEqual({
      x: 320,
      anchor: 'end',
    });
  });

  it('centres a label that fits on its bucket', () => {
    expect(placeTimeTick({ x: 150, index: 4, offset: 15, count: 10, plotWidth: 300, textWidth: 40 })).toEqual({
      x: 150,
      anchor: 'middle',
    });
  });
});

const rows = Array.from({ length: 12 }, (_, i) => ({ label: `Oct 29, ${i + 1} PM`, ts: i, value: 1 }));
const WIDTH = 400;
const Y_WIDTH = 20;

function lastLabel(container: HTMLElement) {
  // Recharts draws tick labels in their own layer, away from the axis group.
  const labels = [...container.querySelectorAll('text')].filter(t => t.textContent?.startsWith('Oct 29'));
  return labels.at(-1);
}

describe('timeXAxis edge labels', () => {
  // The labels used to stop at an estimated plot width (the chart minus a 44px y-axis), so with a
  // narrower y-axis the last label ended well short of the plot's right edge.
  it.each([
    ['bars', <Bar key="v" dataKey="value" isAnimationActive={false} />],
    ['lines', <Line key="v" dataKey="value" isAnimationActive={false} />],
  ])('ends the last %s label on the right edge of the plot', (_, series) => {
    const { container } = render(
      <ComposedChart width={WIDTH} height={200} data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        {timeXAxis({ data: rows, xKey: 'label', timestampKey: 'ts', xLabels: 'edges', plotWidth: WIDTH - 44 })}
        <YAxis width={Y_WIDTH} />
        {series}
      </ComposedChart>,
    );
    const last = lastLabel(container);
    expect(last?.textContent).toBe('Oct 29, 12 PM');
    expect(last?.getAttribute('text-anchor')).toBe('end');
    expect(Number(last?.getAttribute('x'))).toBeCloseTo(WIDTH);
  });
});
