// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { Bar, ComposedChart, Line, LineChart, Tooltip, XAxis } from 'recharts';
import { describe, expect, it, vi } from 'vitest';
import { DragSelectionBand } from './drag-selection-band';
import type { DragSelectionRange } from './drag-selection-range';
import { useDragSelection } from './use-drag-selection';
import { useFixedChartSize } from '@/test/chart-size';

const WIDTH = 600;
const data = ['1 PM', '2 PM', '3 PM', '4 PM'].map((label, i) => ({ label, value: i + 1 }));
const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

type Props = {
  kind: 'bar' | 'line';
  onSelect?: (range: DragSelectionRange) => void;
  onPreview?: (range: DragSelectionRange | undefined) => void;
  onClickPoint?: (index: number) => void;
};

/** A plain Recharts chart wired the way any chart would adopt drag selection. */
function SelectableChart({ kind, onSelect, onPreview, onClickPoint }: Props) {
  const selection = useDragSelection({ onSelect, onPreview });
  const handlers = {
    onMouseDown: selection.onMouseDown,
    onMouseMove: selection.onMouseMove,
    onClick: (state: { activeTooltipIndex?: unknown }) => {
      if (selection.consumeReleaseClick()) return;
      const i = Number(state.activeTooltipIndex);
      if (!Number.isNaN(i)) onClickPoint?.(i);
    },
  };
  const children = [
    <XAxis key="x" dataKey="label" hide />,
    <Tooltip key="tooltip" content={() => null} />,
    selection.enabled && (
      <DragSelectionBand
        key="band"
        selection={selection}
        count={data.length}
        layout={kind === 'bar' ? 'band' : 'point'}
      />
    ),
  ];
  return (
    <div className={selection.className} data-testid="chart">
      {kind === 'bar' ? (
        <ComposedChart width={WIDTH} height={300} data={data} margin={MARGIN} {...handlers}>
          {children}
          <Bar dataKey="value" isAnimationActive={false} />
        </ComposedChart>
      ) : (
        <LineChart width={WIDTH} height={300} data={data} margin={MARGIN} {...handlers}>
          {children}
          <Line dataKey="value" isAnimationActive={false} />
        </LineChart>
      )}
    </div>
  );
}

// Bars own 150px slots (centers 75…525); line points sit 200px apart (0…600).
const POINTER = { bar: [75, 225, 375, 525], line: [10, 200, 400, 590] };

const setup = (props: Props) => {
  const view = render(<SelectableChart {...props} />);
  const wrapper = view.container.querySelector('.recharts-wrapper');
  if (!wrapper) throw new Error('chart did not render');
  const at = (index: number) => ({ clientX: POINTER[props.kind][index], clientY: 20 });
  /** Recharts applies pointer moves on the next animation frame. */
  const moveTo = async (index: number) => {
    fireEvent.mouseMove(wrapper, at(index));
    await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
  };
  const drag = async (from: number, to: number) => {
    await moveTo(from);
    fireEvent.mouseDown(wrapper, at(from));
    await moveTo(to);
  };
  const band = () => view.container.querySelector('[data-slot="chart-drag-selection"]');
  return { ...view, wrapper, at, moveTo, drag, band };
};

describe('drag selection', () => {
  useFixedChartSize(WIDTH, 300);

  describe.each(['bar', 'line'] as const)('on a %s chart', kind => {
    it('reports the ordered first and last points of the drag', async () => {
      const onSelect = vi.fn();
      const { drag, wrapper, at } = setup({ kind, onSelect });

      await drag(3, 1);
      fireEvent.mouseUp(wrapper, at(1));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith({ start: 1, end: 3 });
    });

    it('still selects when the pointer is released outside the chart', async () => {
      const onSelect = vi.fn();
      const { drag, wrapper } = setup({ kind, onSelect });

      await drag(0, 2);
      fireEvent.mouseLeave(wrapper);
      fireEvent.mouseUp(window);

      expect(onSelect).toHaveBeenCalledWith({ start: 0, end: 2 });
    });

    it('previews the range while dragging, and clears it on release', async () => {
      const onPreview = vi.fn();
      const { drag, wrapper, at } = setup({ kind, onSelect: vi.fn(), onPreview });

      await drag(0, 2);
      expect(onPreview).toHaveBeenLastCalledWith({ start: 0, end: 2 });

      fireEvent.mouseUp(wrapper, at(2));
      expect(onPreview).toHaveBeenLastCalledWith(undefined);
    });

    it('keeps a press and release on one point a click', async () => {
      const onSelect = vi.fn();
      const onClickPoint = vi.fn();
      const { moveTo, wrapper, at, band } = setup({ kind, onSelect, onClickPoint });

      await moveTo(2);
      fireEvent.mouseDown(wrapper, at(2));
      expect(band()).toBeNull();
      fireEvent.mouseUp(wrapper, at(2));
      fireEvent.click(wrapper, at(2));

      expect(onSelect).not.toHaveBeenCalled();
      expect(onClickPoint).toHaveBeenCalledWith(2);
    });

    it('does not also click the point where the drag ends', async () => {
      const onClickPoint = vi.fn();
      const { drag, wrapper, at } = setup({ kind, onSelect: vi.fn(), onClickPoint });

      await drag(0, 2);
      fireEvent.mouseUp(wrapper, at(2));
      fireEvent.click(wrapper, at(2));

      expect(onClickPoint).not.toHaveBeenCalled();
    });

    it('ignores drags without an onSelect', async () => {
      const { drag, wrapper, at, band, getByTestId } = setup({ kind });

      await drag(0, 2);
      expect(band()).toBeNull();
      fireEvent.mouseUp(wrapper, at(2));

      expect(getByTestId('chart').className).toBe('');
    });
  });

  it('draws the band over the dragged columns of a bar chart', async () => {
    const { drag, wrapper, at, band, getByTestId } = setup({ kind: 'bar', onSelect: vi.fn() });

    expect(getByTestId('chart').className).toContain('cursor-crosshair');
    await drag(2, 1);
    expect(band()?.getAttribute('x')).toBe('150');
    expect(band()?.getAttribute('width')).toBe('300');

    fireEvent.mouseUp(wrapper, at(1));
    expect(band()).toBeNull();
  });

  it('draws the band halfway to the neighbouring points of a line chart', async () => {
    const { drag, band } = setup({ kind: 'line', onSelect: vi.fn() });

    await drag(1, 2);

    expect(band()?.getAttribute('x')).toBe('100');
    expect(band()?.getAttribute('width')).toBe('400');
  });
});
