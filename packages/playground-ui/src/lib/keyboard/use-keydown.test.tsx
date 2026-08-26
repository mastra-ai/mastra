// @vitest-environment jsdom
import { renderHook, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { useKeydown, useTableKeydown } from './use-keydown';

const pressKey = (key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(window, { key, ...modifiers });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useKeydown', () => {
  it('fires the handler when a single key is pressed', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    pressKey('ArrowUp');

    expect(onArrowUp).toHaveBeenCalledTimes(1);
  });

  it('does not fire the handler for a different key', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    pressKey('ArrowDown');

    expect(onArrowUp).not.toHaveBeenCalled();
  });

  it('matches the main key case-insensitively', () => {
    const onK = vi.fn();
    renderHook(() => useKeydown({ k: onK }));

    pressKey('K');

    expect(onK).toHaveBeenCalledTimes(1);
  });

  it('fires the handler when a modifier combo is pressed', () => {
    const onCmdK = vi.fn();
    renderHook(() => useKeydown({ 'cmd+k': onCmdK }));

    pressKey('k', { metaKey: true });

    expect(onCmdK).toHaveBeenCalledTimes(1);
  });

  it('supports multiple modifiers in a combo', () => {
    const onCtrlShiftP = vi.fn();
    renderHook(() => useKeydown({ 'ctrl+shift+p': onCtrlShiftP }));

    pressKey('p', { ctrlKey: true, shiftKey: true });

    expect(onCtrlShiftP).toHaveBeenCalledTimes(1);
  });

  it('does not fire a combo when a required modifier is missing', () => {
    const onCmdK = vi.fn();
    renderHook(() => useKeydown({ 'cmd+k': onCmdK }));

    pressKey('k');

    expect(onCmdK).not.toHaveBeenCalled();
  });

  it('does not fire a plain key handler when a modifier is held', () => {
    const onK = vi.fn();
    renderHook(() => useKeydown({ k: onK }));

    pressKey('k', { metaKey: true });

    expect(onK).not.toHaveBeenCalled();
  });

  it('supports modifier aliases (meta, control, option)', () => {
    const onMeta = vi.fn();
    const onControl = vi.fn();
    const onOption = vi.fn();
    renderHook(() =>
      useKeydown({
        'meta+a': onMeta,
        'control+b': onControl,
        'option+c': onOption,
      }),
    );

    pressKey('a', { metaKey: true });
    pressKey('b', { ctrlKey: true });
    pressKey('c', { altKey: true });

    expect(onMeta).toHaveBeenCalledTimes(1);
    expect(onControl).toHaveBeenCalledTimes(1);
    expect(onOption).toHaveBeenCalledTimes(1);
  });

  it('resolves "mod" to cmd on mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla (Macintosh)' });
    const onModK = vi.fn();
    renderHook(() => useKeydown({ 'mod+k': onModK }));

    pressKey('k', { metaKey: true });

    expect(onModK).toHaveBeenCalledTimes(1);
  });

  it('resolves "mod" to ctrl on non-mac platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla (Windows NT 10.0)' });
    const onModK = vi.fn();
    renderHook(() => useKeydown({ 'mod+k': onModK }));

    pressKey('k', { ctrlKey: true });

    expect(onModK).toHaveBeenCalledTimes(1);
  });

  it('prevents the default behavior on match', () => {
    renderHook(() => useKeydown({ 'cmd+k': vi.fn() }));

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('uses the latest handler when the map changes between renders', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useKeydown({ ArrowUp: handler }), {
      initialProps: { handler: first },
    });

    rerender({ handler: second });
    pressKey('ArrowUp');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops firing after unmount', () => {
    const onArrowUp = vi.fn();
    const { unmount } = renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    unmount();
    pressKey('ArrowUp');

    expect(onArrowUp).not.toHaveBeenCalled();
  });
});

describe('useKeydown with a scoped target', () => {
  const ScopedHarness = ({ onHit }: { onHit: () => void }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    useKeydown({ ArrowDown: onHit }, { target: ref });
    return (
      <div ref={ref} data-testid="scope">
        <button data-testid="inside">inside</button>
      </div>
    );
  };

  it('fires when the key is pressed inside the target', () => {
    const onHit = vi.fn();
    render(
      <div>
        <ScopedHarness onHit={onHit} />
        <button data-testid="outside">outside</button>
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('inside'), { key: 'ArrowDown' });

    expect(onHit).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the key is pressed outside the target', () => {
    const onHit = vi.fn();
    render(
      <div>
        <ScopedHarness onHit={onHit} />
        <button data-testid="outside">outside</button>
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('outside'), { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(onHit).not.toHaveBeenCalled();
  });
});

type TableHarnessProps = {
  count: number;
  pageSize?: number;
  onActivate?: (index: number) => void;
  onNavigate?: (index: number) => void;
};

const TableHarness = ({ count, pageSize, onActivate, onNavigate }: TableHarnessProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeIndex, getRowProps, getContainerProps } = useTableKeydown({
    count,
    containerRef,
    pageSize,
    onActivate,
    onNavigate,
  });

  return (
    <div ref={containerRef} data-testid="table" {...getContainerProps()}>
      <span data-testid="active-index">{activeIndex}</span>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} data-testid={`row-${i}`} {...getRowProps(i)}>
          Row {i}
        </button>
      ))}
    </div>
  );
};

const row = (i: number) => screen.getByTestId(`row-${i}`);
const activeIndexOf = () => Number(screen.getByTestId('active-index').textContent);
const pressOnRow = (i: number, key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(row(i), { key, ...modifiers });
};

describe('useTableKeydown', () => {
  it('starts at index 0 with only the active row tabbable', () => {
    render(<TableHarness count={3} />);

    expect(activeIndexOf()).toBe(0);
    expect(row(0).tabIndex).toBe(0);
    expect(row(1).tabIndex).toBe(-1);
    expect(row(2).tabIndex).toBe(-1);
  });

  it('moves down with ArrowDown and moves DOM focus to the new row', () => {
    render(<TableHarness count={3} />);
    row(0).focus();

    pressOnRow(0, 'ArrowDown');

    expect(activeIndexOf()).toBe(1);
    expect(document.activeElement).toBe(row(1));
    expect(row(1).tabIndex).toBe(0);
    expect(row(0).tabIndex).toBe(-1);
  });

  it('moves up with ArrowUp', () => {
    render(<TableHarness count={3} />);
    row(0).focus();
    pressOnRow(0, 'ArrowDown');
    pressOnRow(1, 'ArrowUp');

    expect(activeIndexOf()).toBe(0);
    expect(document.activeElement).toBe(row(0));
  });

  it('clamps at the boundaries instead of wrapping', () => {
    render(<TableHarness count={3} />);
    row(0).focus();

    pressOnRow(0, 'ArrowUp');
    expect(activeIndexOf()).toBe(0);

    pressOnRow(0, 'End');
    pressOnRow(2, 'ArrowDown');
    expect(activeIndexOf()).toBe(2);
  });

  it('jumps to the last row with End and the first row with Home', () => {
    render(<TableHarness count={5} />);
    row(0).focus();

    pressOnRow(0, 'End');
    expect(activeIndexOf()).toBe(4);
    expect(document.activeElement).toBe(row(4));

    pressOnRow(4, 'Home');
    expect(activeIndexOf()).toBe(0);
    expect(document.activeElement).toBe(row(0));
  });

  it('supports mod+Home and mod+End', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla (Macintosh)' });
    render(<TableHarness count={5} />);
    row(0).focus();

    pressOnRow(0, 'End', { metaKey: true });
    expect(activeIndexOf()).toBe(4);

    pressOnRow(4, 'Home', { metaKey: true });
    expect(activeIndexOf()).toBe(0);
  });

  it('moves by pageSize with PageDown/PageUp, clamped', () => {
    render(<TableHarness count={25} pageSize={10} />);
    row(0).focus();

    pressOnRow(0, 'PageDown');
    expect(activeIndexOf()).toBe(10);

    pressOnRow(10, 'PageDown');
    pressOnRow(20, 'PageDown');
    expect(activeIndexOf()).toBe(24);

    pressOnRow(24, 'PageUp');
    expect(activeIndexOf()).toBe(14);
  });

  it('does not react to keys pressed outside the container', () => {
    render(
      <div>
        <TableHarness count={3} />
        <button data-testid="elsewhere">elsewhere</button>
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('elsewhere'), { key: 'ArrowDown' });

    expect(activeIndexOf()).toBe(0);
  });

  it('keeps two tables independent', () => {
    const Two = () => (
      <div>
        <TableHarness count={3} />
        <TableHarness count={3} />
      </div>
    );
    render(<Two />);
    const [firstActive, secondActive] = screen.getAllByTestId('active-index');
    const [firstRow0] = screen.getAllByTestId('row-0');

    fireEvent.keyDown(firstRow0, { key: 'ArrowDown' });

    expect(firstActive.textContent).toBe('1');
    expect(secondActive.textContent).toBe('0');
  });

  it('syncs activeIndex when a row receives focus directly', () => {
    render(<TableHarness count={3} />);

    fireEvent.focus(row(2));

    expect(activeIndexOf()).toBe(2);
    expect(row(2).tabIndex).toBe(0);
    expect(row(0).tabIndex).toBe(-1);
  });

  it('calls onNavigate with the next index before focusing', () => {
    const onNavigate = vi.fn();
    render(<TableHarness count={3} onNavigate={onNavigate} />);
    row(0).focus();

    pressOnRow(0, 'ArrowDown');

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('clamps activeIndex when count shrinks', () => {
    const { rerender } = render(<TableHarness count={5} />);
    row(0).focus();
    pressOnRow(0, 'End');
    expect(activeIndexOf()).toBe(4);

    rerender(<TableHarness count={2} />);

    expect(activeIndexOf()).toBe(1);
  });
});
