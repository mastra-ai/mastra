// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVE_ATTR, useFluidHover, useRegisterFluidHoverItem, type UseFluidHoverOptions } from './use-fluid-hover';
import { FluidHoverHighlight } from '@/components/fluid-hover-highlight';

const ROW_HEIGHT = 40;

/** jsdom has no layout: give each row a real offset box so the hook can measure it. */
function layoutRow(element: HTMLElement, index: number) {
  Object.defineProperties(element, {
    offsetParent: { value: element.parentElement, configurable: true },
    offsetTop: { value: index * ROW_HEIGHT, configurable: true },
    offsetLeft: { value: 0, configurable: true },
    offsetWidth: { value: 200, configurable: true },
    offsetHeight: { value: ROW_HEIGHT, configurable: true },
  });
}

function Row({
  index,
  registerItem,
  onClick,
}: {
  index: number;
  registerItem: (index: number, element: HTMLElement | null) => void;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);
  return (
    <button
      ref={el => {
        ref.current = el;
        if (el) layoutRow(el, index);
      }}
      data-testid={`row-${index}`}
      data-index={index}
      onClick={onClick}
    >
      Row {index}
    </button>
  );
}

function List({
  options,
  onRowClick,
  onHover,
}: {
  options?: UseFluidHoverOptions;
  onRowClick?: (index: number) => void;
  onHover?: (hover: ReturnType<typeof useFluidHover>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(ref, options);
  onHover?.(hover);
  return (
    <div
      ref={el => {
        ref.current = el;
        if (el) {
          Object.defineProperties(el, {
            offsetWidth: { value: 200, configurable: true },
            offsetHeight: { value: ROW_HEIGHT * 3, configurable: true },
          });
          el.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 200, height: ROW_HEIGHT * 3, right: 200, bottom: ROW_HEIGHT * 3 }) as DOMRect;
        }
      }}
      data-testid="list"
      {...hover.handlers}
    >
      <FluidHoverHighlight hover={hover} />
      {[0, 1, 2].map(index => (
        <Row key={index} index={index} registerItem={hover.registerItem} onClick={() => onRowClick?.(index)} />
      ))}
    </div>
  );
}

/** Flush the hook's rAF-coalesced measurement and pointer picks. */
const flushFrames = async () => {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
};

const moveTo = async (index: number) => {
  fireEvent.mouseEnter(screen.getByTestId('list'));
  fireEvent.mouseMove(screen.getByTestId('list'), { clientX: 10, clientY: index * ROW_HEIGHT + ROW_HEIGHT / 2 });
  await flushFrames();
};

describe('useFluidHover', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('when the mouse moves over a row', () => {
    it('marks that row as active', async () => {
      render(<List />);
      await flushFrames();

      await moveTo(1);

      expect(screen.getByTestId('row-1').hasAttribute(ACTIVE_ATTR)).toBe(true);
      expect(screen.getByTestId('list').getAttribute('data-fluid-hover-active-index')).toBe('1');
    });

    it('renders the highlight on the active row', async () => {
      render(<List />);
      await flushFrames();

      await moveTo(2);

      expect(screen.getByTestId('list').querySelector('[data-slot="fluid-hover-highlight"]')).not.toBeNull();
    });
  });

  describe('when a row is disabled', () => {
    const options: UseFluidHoverOptions = {
      isItemDisabled: el => el.dataset.index === '1',
    };

    it('lights the nearest enabled row instead', async () => {
      render(<List options={options} />);
      await flushFrames();

      await moveTo(1);

      expect(screen.getByTestId('row-1').hasAttribute(ACTIVE_ATTR)).toBe(false);
      expect(screen.getByTestId('list').hasAttribute('data-fluid-hover-active-index')).toBe(true);
    });
  });

  describe('when the mouse leaves the container', () => {
    it('clears the active row', async () => {
      render(<List />);
      await flushFrames();
      await moveTo(1);

      fireEvent.mouseLeave(screen.getByTestId('list'));

      expect(screen.getByTestId('row-1').hasAttribute(ACTIVE_ATTR)).toBe(false);
      expect(screen.getByTestId('list').hasAttribute('data-fluid-hover-active-index')).toBe(false);
    });
  });

  describe('when setActiveIndex is called', () => {
    it('lights the requested row without pointer input', async () => {
      let hover: ReturnType<typeof useFluidHover> | undefined;
      render(<List onHover={h => (hover = h)} />);
      await flushFrames();

      act(() => hover?.setActiveIndex(2));

      expect(screen.getByTestId('row-2').hasAttribute(ACTIVE_ATTR)).toBe(true);
    });
  });

  describe('when a click lands in a gap', () => {
    it('routes the click to the active row', async () => {
      const onRowClick = vi.fn();
      render(<List onRowClick={onRowClick} />);
      await flushFrames();
      await moveTo(1);

      fireEvent.click(screen.getByTestId('list'), { clientX: 10, clientY: ROW_HEIGHT * 3 + 5 });

      expect(onRowClick).toHaveBeenCalledWith(1);
    });
  });
});
