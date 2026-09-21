// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluidMenuItems, useFluidMenu, useFluidMenuItemRef } from './fluid-menu';

const ROW_HEIGHT = 32;

function stubLayout(element: HTMLElement, top: number) {
  Object.defineProperty(element, 'offsetParent', { value: element.parentElement, configurable: true });
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(element, 'offsetLeft', { value: 0, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: 120, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: ROW_HEIGHT, configurable: true });
}

const Row = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
  <button type="button" ref={useFluidMenuItemRef(ref)} {...props} />
));
Row.displayName = 'Row';

function Menu({ rows = ['a', 'b', 'c'], activeAttr }: { rows?: string[]; activeAttr?: 'data-selected' }) {
  const menu = useFluidMenu<HTMLDivElement>(activeAttr ? { activeAttr } : undefined);
  return (
    <div data-testid="menu" className={menu.containerClassName} {...menu.getContainerProps({})}>
      <FluidMenuItems menu={menu}>
        {rows.map(row => (
          <Row key={row} data-disabled={row === 'b' ? '' : undefined}>
            {row}
          </Row>
        ))}
      </FluidMenuItems>
    </div>
  );
}

async function flushFrames() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
  }
}

function activeRow() {
  return screen.getByTestId('menu').querySelector('[data-fluid-hover-active]')?.textContent ?? null;
}

describe('fluid-menu primitive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function setup(props?: React.ComponentProps<typeof Menu>) {
    const view = render(<Menu {...props} />);
    screen.getAllByRole('button').forEach((row, i) => stubLayout(row, i * ROW_HEIGHT));
    const menu = screen.getByTestId('menu');
    Object.defineProperty(menu, 'getBoundingClientRect', {
      value: () => ({ top: 0, left: 0, width: 120, height: 3 * ROW_HEIGHT, right: 120, bottom: 96 }),
    });
    await flushFrames();
    return view;
  }

  describe('when the pointer moves over a row', () => {
    it('lights that row', async () => {
      await setup();
      fireEvent.mouseMove(screen.getByTestId('menu'), { clientX: 10, clientY: ROW_HEIGHT * 2 + 5 });
      await flushFrames();
      expect(activeRow()).toBe('c');
    });

    it('skips a disabled row', async () => {
      await setup();
      fireEvent.mouseMove(screen.getByTestId('menu'), { clientX: 10, clientY: ROW_HEIGHT + 5 });
      await flushFrames();
      expect(activeRow()).not.toBe('b');
    });

    it('treats data-disabled="false" (cmdk) as enabled', async () => {
      await setup();
      screen.getByText('c').setAttribute('data-disabled', 'false');
      fireEvent.mouseMove(screen.getByTestId('menu'), { clientX: 10, clientY: ROW_HEIGHT * 2 + 5 });
      await flushFrames();
      expect(activeRow()).toBe('c');
    });
  });

  describe('when the library marks a row highlighted (keyboard path)', () => {
    it('moves the highlight to that row', async () => {
      await setup();
      await act(async () => {
        screen.getByText('c').setAttribute('data-highlighted', '');
      });
      await flushFrames();
      expect(activeRow()).toBe('c');
    });

    it('honours a custom active attribute', async () => {
      await setup({ activeAttr: 'data-selected' });
      await act(async () => {
        screen.getByText('a').setAttribute('data-selected', 'true');
      });
      await flushFrames();
      expect(activeRow()).toBe('a');
    });
  });

  describe('when a row renders outside a provider', () => {
    it('still renders and forwards its ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Row ref={ref}>solo</Row>);
      expect(ref.current?.textContent).toBe('solo');
    });
  });
});
