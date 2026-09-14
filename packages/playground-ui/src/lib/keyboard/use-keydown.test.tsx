// @vitest-environment jsdom
import { renderHook, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { parseKeyBinding, useKeydown, useTableKeydown } from './use-keydown';

const pressKey = (key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(window, { key, ...modifiers });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('parseKeyBinding', () => {
  const noMods = { meta: false, ctrl: false, shift: false, alt: false };

  it('given a plain combo, then returns a single step without timeout', () => {
    expect(parseKeyBinding('cmd+k')).toEqual([{ ...noMods, meta: true, key: 'k' }]);
  });

  it('given "g{300}+a", then returns two steps with a 300ms window after the first', () => {
    expect(parseKeyBinding('g{300}+a')).toEqual([
      { ...noMods, key: 'g', timeoutMs: 300 },
      { ...noMods, key: 'a' },
    ]);
  });

  it('given modifiers around a timed token, then modifiers belong to their own step', () => {
    expect(parseKeyBinding('cmd+k{500}+cmd+s')).toEqual([
      { ...noMods, meta: true, key: 'k', timeoutMs: 500 },
      { ...noMods, meta: true, key: 's' },
    ]);
  });

  it('given three timed tokens, then returns three steps', () => {
    expect(parseKeyBinding('a{100}+b{100}+c')).toEqual([
      { ...noMods, key: 'a', timeoutMs: 100 },
      { ...noMods, key: 'b', timeoutMs: 100 },
      { ...noMods, key: 'c' },
    ]);
  });

  it('given a timeout on the last step, then throws', () => {
    expect(() => parseKeyBinding('g{300}')).toThrow();
  });
});

describe('useKeydown', () => {
  it('fires the handler when a single key is pressed', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    pressKey('ArrowUp');

    expect(onArrowUp).toHaveBeenCalledTimes(1);
  });

  it('fires a "?" binding even though the key is typed with Shift', () => {
    const onHelp = vi.fn();
    renderHook(() => useKeydown({ '?': onHelp }));

    pressKey('?', { shiftKey: true });

    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  describe('given the user is typing in a field', () => {
    const typeInField = (tag: 'input' | 'textarea', key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
      const field = document.createElement(tag);
      document.body.appendChild(field);
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
      field.dispatchEvent(event);
      field.remove();
      return event;
    };

    it('when "?" is typed in an input, then the binding does not fire and the character is not blocked', () => {
      const onHelp = vi.fn();
      renderHook(() => useKeydown({ '?': onHelp }));

      const event = typeInField('input', '?', { shiftKey: true });

      expect(onHelp).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('when a sequence prefix is typed in a textarea, then the sequence is not armed', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      const armed = typeInField('textarea', 'g');
      typeInField('textarea', 'a');

      expect(armed.defaultPrevented).toBe(false);
      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when a modifier combo is pressed in an input, then it still fires', () => {
      const onSearch = vi.fn();
      vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla (Macintosh)' });
      renderHook(() => useKeydown({ 'mod+k': onSearch }));

      typeInField('input', 'k', { metaKey: true });

      expect(onSearch).toHaveBeenCalledTimes(1);
    });
  });

  it('does not let a shifted symbol relax Shift for letter bindings', () => {
    const onA = vi.fn();
    renderHook(() => useKeydown({ a: onA }));

    pressKey('A', { shiftKey: true });

    expect(onA).not.toHaveBeenCalled();
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

  it('does not attach a listener when enabled is false', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }, { enabled: false }));

    pressKey('ArrowUp');

    expect(onArrowUp).not.toHaveBeenCalled();
  });

  it('attaches and detaches the listener when enabled toggles', () => {
    const onArrowUp = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useKeydown({ ArrowUp: onArrowUp }, { enabled }), {
      initialProps: { enabled: false },
    });

    pressKey('ArrowUp');
    expect(onArrowUp).not.toHaveBeenCalled();

    rerender({ enabled: true });
    pressKey('ArrowUp');
    expect(onArrowUp).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    pressKey('ArrowUp');
    expect(onArrowUp).toHaveBeenCalledTimes(1);
  });

  it('leaves the event untouched when shouldHandle returns false', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }, { shouldHandle: () => false }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    window.dispatchEvent(event);

    expect(onArrowUp).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('passes the event to shouldHandle', () => {
    const onArrowUp = vi.fn();
    const shouldHandle = vi.fn((event: KeyboardEvent) => !event.repeat);
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }, { shouldHandle }));

    pressKey('ArrowUp', { repeat: true });
    expect(onArrowUp).not.toHaveBeenCalled();

    pressKey('ArrowUp');
    expect(onArrowUp).toHaveBeenCalledTimes(1);
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

describe('useKeydown sequences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('given a "g{300}+a" binding', () => {
    it('when g then a within 300ms, then the handler fires once', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('g');
      vi.advanceTimersByTime(100);
      pressKey('a');

      expect(onGoAgents).toHaveBeenCalledTimes(1);
    });

    it('when g then a after 300ms, then the handler does not fire', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('g');
      vi.advanceTimersByTime(300);
      pressKey('a');

      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when g then a at 299ms, then the handler fires', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('g');
      vi.advanceTimersByTime(299);
      pressKey('a');

      expect(onGoAgents).toHaveBeenCalledTimes(1);
    });

    it('when a alone is pressed, then the handler does not fire', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('a');

      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when an unexpected key interrupts the sequence, then the handler does not fire', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('g');
      pressKey('x');
      pressKey('a');

      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when an unexpected key is itself a plain binding, then that binding fires', () => {
      const onGoAgents = vi.fn();
      const onX = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents, x: onX }));

      pressKey('g');
      pressKey('x');

      expect(onX).toHaveBeenCalledTimes(1);
      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when g is pressed, then the prefix event is default-prevented', () => {
      renderHook(() => useKeydown({ 'g{300}+a': vi.fn() }));

      const event = new KeyboardEvent('keydown', { key: 'g', cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('given also a plain "g" binding, when g is pressed, then the prefix wins', () => {
      const onGoAgents = vi.fn();
      const onG = vi.fn();
      renderHook(() => useKeydown({ g: onG, 'g{300}+a': onGoAgents }));

      pressKey('g');
      expect(onG).not.toHaveBeenCalled();

      pressKey('a');
      expect(onGoAgents).toHaveBeenCalledTimes(1);
    });

    it('when the sequence completes twice, then the handler fires twice', () => {
      const onGoAgents = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }));

      pressKey('g');
      pressKey('a');
      pressKey('g');
      pressKey('a');

      expect(onGoAgents).toHaveBeenCalledTimes(2);
    });

    it('given shouldHandle rejects the second key, then the sequence stays armed', () => {
      const onGoAgents = vi.fn();
      const shouldHandle = vi.fn((event: KeyboardEvent) => !event.repeat);
      renderHook(() => useKeydown({ 'g{300}+a': onGoAgents }, { shouldHandle }));

      pressKey('g');
      pressKey('a', { repeat: true });
      expect(onGoAgents).not.toHaveBeenCalled();

      pressKey('a');
      expect(onGoAgents).toHaveBeenCalledTimes(1);
    });

    it('when enabled flips to false mid-sequence, then the handler does not fire', () => {
      const onGoAgents = vi.fn();
      const { rerender } = renderHook(({ enabled }) => useKeydown({ 'g{300}+a': onGoAgents }, { enabled }), {
        initialProps: { enabled: true },
      });

      pressKey('g');
      rerender({ enabled: false });
      rerender({ enabled: true });
      pressKey('a');

      expect(onGoAgents).not.toHaveBeenCalled();
    });

    it('when unmounted mid-sequence, then no timer is left behind', () => {
      const { unmount } = renderHook(() => useKeydown({ 'g{300}+a': vi.fn() }));

      pressKey('g');
      expect(vi.getTimerCount()).toBe(1);

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('given a three-step "a{100}+b{100}+c" binding', () => {
    it('when each key is pressed within its window, then the handler fires', () => {
      const handler = vi.fn();
      renderHook(() => useKeydown({ 'a{100}+b{100}+c': handler }));

      pressKey('a');
      vi.advanceTimersByTime(50);
      pressKey('b');
      vi.advanceTimersByTime(50);
      pressKey('c');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('when the last window expires, then the handler does not fire', () => {
      const handler = vi.fn();
      renderHook(() => useKeydown({ 'a{100}+b{100}+c': handler }));

      pressKey('a');
      pressKey('b');
      vi.advanceTimersByTime(150);
      pressKey('c');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('given several sequences sharing the "g" prefix', () => {
    it('when g then the key of a later binding, then that binding fires', () => {
      const agents = vi.fn();
      const workflows = vi.fn();
      const tools = vi.fn();
      renderHook(() => useKeydown({ 'g{300}+a': agents, 'g{300}+w': workflows, 'g{300}+t': tools }));

      pressKey('g');
      pressKey('t');
      pressKey('g');
      pressKey('w');

      expect(tools).toHaveBeenCalledTimes(1);
      expect(workflows).toHaveBeenCalledTimes(1);
      expect(agents).not.toHaveBeenCalled();
    });
  });

  describe('given a "cmd+k{500}+cmd+s" binding', () => {
    it('when cmd+k then cmd+s, then the handler fires', () => {
      const handler = vi.fn();
      renderHook(() => useKeydown({ 'cmd+k{500}+cmd+s': handler }));

      pressKey('k', { metaKey: true });
      pressKey('s', { metaKey: true });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('when cmd+k then plain s, then the handler does not fire', () => {
      const handler = vi.fn();
      renderHook(() => useKeydown({ 'cmd+k{500}+cmd+s': handler }));

      pressKey('k', { metaKey: true });
      pressKey('s');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('given a scoped target', () => {
    const SequenceHarness = ({ onHit }: { onHit: () => void }) => {
      const ref = useRef<HTMLDivElement | null>(null);
      useKeydown({ 'g{300}+a': onHit }, { target: ref });
      return (
        <div>
          <div ref={ref}>
            <button data-testid="inside">inside</button>
          </div>
          <button data-testid="outside">outside</button>
        </div>
      );
    };

    it('when the sequence is typed inside the target, then the handler fires', () => {
      const onHit = vi.fn();
      render(<SequenceHarness onHit={onHit} />);

      fireEvent.keyDown(screen.getByTestId('inside'), { key: 'g' });
      fireEvent.keyDown(screen.getByTestId('inside'), { key: 'a' });

      expect(onHit).toHaveBeenCalledTimes(1);
    });

    it('when the sequence is typed outside the target, then the handler does not fire', () => {
      const onHit = vi.fn();
      render(<SequenceHarness onHit={onHit} />);

      fireEvent.keyDown(screen.getByTestId('outside'), { key: 'g' });
      fireEvent.keyDown(screen.getByTestId('outside'), { key: 'a' });

      expect(onHit).not.toHaveBeenCalled();
    });
  });
});

type TableHarnessProps = {
  count: number;
  pageSize?: number;
  onActivate?: (index: number) => void;
  onNavigate?: (index: number) => void;
  global?: boolean;
};

const TableHarness = ({ count, pageSize, onActivate, onNavigate, global }: TableHarnessProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeIndex, getRowProps, getContainerProps } = useTableKeydown({
    count,
    containerRef,
    pageSize,
    onActivate,
    onNavigate,
    global,
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

describe('useTableKeydown global', () => {
  it('focuses the current row on the first ArrowDown from body, then moves', () => {
    render(<TableHarness count={3} global />);
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(0));
    expect(activeIndexOf()).toBe(0);

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(1));
    expect(activeIndexOf()).toBe(1);
  });

  it('ignores arrows typed into an input outside the list', () => {
    render(
      <div>
        <TableHarness count={3} global />
        <input data-testid="search" />
      </div>,
    );
    const search = screen.getByTestId('search');
    search.focus();

    const prevented = !fireEvent.keyDown(search, { key: 'ArrowDown' });

    expect(prevented).toBe(false);
    expect(document.activeElement).toBe(search);
    expect(activeIndexOf()).toBe(0);
  });

  it('ignores arrows from inside a dialog', () => {
    render(
      <div>
        <TableHarness count={3} global />
        <div role="dialog">
          <button data-testid="in-dialog">ok</button>
        </div>
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('in-dialog'), { key: 'ArrowDown' });

    expect(activeIndexOf()).toBe(0);
  });

  it('moves only once when the key is pressed on a focused row', () => {
    render(<TableHarness count={3} global />);
    row(0).focus();

    pressOnRow(0, 'ArrowDown');

    expect(activeIndexOf()).toBe(1);
    expect(document.activeElement).toBe(row(1));
  });

  it('does not handle Home/End from body but still does from a row', () => {
    render(<TableHarness count={3} global />);

    fireEvent.keyDown(document.body, { key: 'End' });
    expect(activeIndexOf()).toBe(0);

    row(0).focus();
    pressOnRow(0, 'End');
    expect(activeIndexOf()).toBe(2);
  });

  it('does nothing from body when global is not set', () => {
    render(<TableHarness count={3} />);

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });

    expect(activeIndexOf()).toBe(0);
    expect(document.activeElement).toBe(document.body);
  });

  it('stops handling global keys after unmount', () => {
    const { unmount } = render(<TableHarness count={3} global />);

    unmount();
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
