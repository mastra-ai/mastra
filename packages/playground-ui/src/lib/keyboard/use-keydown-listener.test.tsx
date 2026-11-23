// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsProvider } from './keyboard-shortcuts-context';
import { useKeydown } from './use-keydown';

afterEach(cleanup);

describe('useKeydown listener composition', () => {
  it('lets a declined key reach React without submitting a selected item twice', () => {
    const selectOption = vi.fn();
    const submitMessage = vi.fn();
    const globalShortcut = vi.fn();
    function Composer({ exactCommand }: { exactCommand: boolean }) {
      const inputRef = useRef<HTMLTextAreaElement>(null);
      useKeydown({ Enter: globalShortcut });
      useKeydown({ Enter: selectOption }, { target: inputRef, shouldHandle: () => !exactCommand });
      return (
        <textarea
          ref={inputRef}
          onKeyDown={event => {
            if (event.defaultPrevented) return;
            event.preventDefault();
            submitMessage();
          }}
        />
      );
    }
    const { rerender } = render(<Composer exactCommand={false} />, { wrapper: KeyboardShortcutsProvider });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(selectOption).toHaveBeenCalledTimes(1);
    expect(submitMessage).not.toHaveBeenCalled();
    expect(globalShortcut).not.toHaveBeenCalled();

    rerender(<Composer exactCommand />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(selectOption).toHaveBeenCalledTimes(1);
    expect(submitMessage).toHaveBeenCalledTimes(1);
    expect(globalShortcut).not.toHaveBeenCalled();
  });

  it('preserves keys consumed during capture before scoped and window shortcuts', () => {
    const scopedShortcut = vi.fn();
    const globalShortcut = vi.fn();
    function NestedShortcuts() {
      const inputRef = useRef<HTMLTextAreaElement>(null);
      useKeydown({ 'ctrl+k': globalShortcut });
      useKeydown({ 'ctrl+k': scopedShortcut }, { target: inputRef });
      return <textarea ref={inputRef} onKeyDownCapture={event => event.preventDefault()} />;
    }
    render(<NestedShortcuts />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'k', ctrlKey: true });
    expect(scopedShortcut).not.toHaveBeenCalled();
    expect(globalShortcut).not.toHaveBeenCalled();
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])('leaves IME composition untouched %j', flags => {
    const scopedShortcut = vi.fn();
    const globalShortcut = vi.fn();
    function KeyboardInput() {
      const inputRef = useRef<HTMLTextAreaElement>(null);
      useKeydown({ 'ctrl+Enter': globalShortcut });
      useKeydown({ 'ctrl+Enter': scopedShortcut }, { target: inputRef });
      return <textarea ref={inputRef} />;
    }
    render(<KeyboardInput />);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true, ...flags })).toBe(true);
    expect(scopedShortcut).not.toHaveBeenCalled();
    expect(globalShortcut).not.toHaveBeenCalled();
  });

  it('leaves nested fields alone when a shortcut targets their container', () => {
    const moveSelection = vi.fn();
    const navigatePage = vi.fn();
    function SearchPanel() {
      const containerRef = useRef<HTMLDivElement>(null);
      useKeydown({ ArrowDown: moveSelection, g: navigatePage }, { target: containerRef });
      return (
        <div ref={containerRef}>
          <textarea />
          <button>Results</button>
        </div>
      );
    }
    render(<SearchPanel />);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'g' })).toBe(true);
    expect(moveSelection).not.toHaveBeenCalled();
    expect(navigatePage).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(moveSelection).toHaveBeenCalledTimes(1);
  });
});
