// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StrictMode, useRef, type ReactNode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { KeyboardScope, KeyboardShortcutsProvider } from './keyboard-shortcuts-context';
import { useKeydown, type UseKeydownArgs, type UseKeydownOptions } from './use-keydown';

const pressKey = (key: string, modifiers: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(window, { key, ...modifiers });

const pressSequence = (...keys: string[]) => {
  for (const key of keys) pressKey(key);
};

const Shortcuts = ({ bindings, options }: { bindings: UseKeydownArgs; options?: UseKeydownOptions }) => {
  useKeydown(bindings, options);
  return null;
};

const Page = ({ children }: { children: ReactNode }) => <KeyboardScope>{children}</KeyboardScope>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useKeydown inside KeyboardShortcutsProvider', () => {
  describe('when a scoped sequence rejects a shared prefix', () => {
    it('executes the distinct accepted global sequence only', () => {
      const onAgents = vi.fn();
      const onTraces = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onAgents }} />
          <KeyboardScope>
            <Shortcuts bindings={{ 'g$+t': onTraces }} options={{ shouldHandle: () => false }} />
          </KeyboardScope>
        </KeyboardShortcutsProvider>,
      );

      pressSequence('g', 'a');

      expect(onAgents).toHaveBeenCalledTimes(1);
      expect(onTraces).not.toHaveBeenCalled();
    });
  });

  describe('when a rejected scoped sequence shadows a global sequence', () => {
    it('does not fall back to the global traces action', () => {
      const onGlobal = vi.fn();
      const onScoped = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': vi.fn(), 'g$+t': onGlobal }} />
          <KeyboardScope>
            <Shortcuts bindings={{ 'g$+t': onScoped }} options={{ shouldHandle: () => false }} />
          </KeyboardScope>
        </KeyboardShortcutsProvider>,
      );
      pressSequence('g', 't');
      expect(onGlobal).not.toHaveBeenCalled();
      expect(onScoped).not.toHaveBeenCalled();
    });
  });

  describe('when every sequence rejects the prefix', () => {
    it('leaves the prefix untouched and does not arm a continuation', () => {
      const onAgents = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onAgents }} options={{ shouldHandle: event => event.key !== 'g' }} />
        </KeyboardShortcutsProvider>,
      );
      expect(pressKey('g')).toBe(true);
      pressKey('a');
      expect(onAgents).not.toHaveBeenCalled();
    });
  });

  describe('when a sequence rejects only its first step', () => {
    it('does not join another sequence that accepted the prefix', () => {
      const onTraces = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': vi.fn() }} />
          <KeyboardScope>
            <Shortcuts bindings={{ 'g$+t': onTraces }} options={{ shouldHandle: event => event.key !== 'g' }} />
          </KeyboardScope>
        </KeyboardShortcutsProvider>,
      );
      pressSequence('g', 't');
      expect(onTraces).not.toHaveBeenCalled();
    });
  });

  describe('when a hook is disabled and re-enabled during a sequence', () => {
    it('does not resume the old prefix', () => {
      const onAgents = vi.fn();
      const App = ({ enabled }: { enabled: boolean }) => (
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onAgents }} options={{ enabled }} />
        </KeyboardShortcutsProvider>
      );
      const { rerender } = render(<App enabled />);
      pressKey('g');
      rerender(<App enabled={false} />);
      rerender(<App enabled />);
      pressKey('a');
      expect(onAgents).not.toHaveBeenCalled();
    });
  });

  describe('when a hook is re-enabled after losing its prefix', () => {
    it('executes a fresh complete sequence once', () => {
      const onAgents = vi.fn();
      const App = ({ enabled }: { enabled: boolean }) => (
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onAgents }} options={{ enabled }} />
        </KeyboardShortcutsProvider>
      );
      const { rerender } = render(<App enabled />);
      pressKey('g');
      rerender(<App enabled={false} />);
      expect(vi.getTimerCount()).toBe(0);
      rerender(<App enabled />);
      pressSequence('g', 'a');
      expect(onAgents).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a hook remounts while its provider stays mounted', () => {
    it('requires a fresh complete sequence', () => {
      const onAgents = vi.fn();
      const App = ({ mounted }: { mounted: boolean }) => (
        <KeyboardShortcutsProvider>
          {mounted && <Shortcuts bindings={{ 'g$+a': onAgents }} />}
        </KeyboardShortcutsProvider>
      );
      const { rerender } = render(<App mounted />);
      pressKey('g');
      rerender(<App mounted={false} />);
      rerender(<App mounted />);
      pressKey('a');
      expect(onAgents).not.toHaveBeenCalled();
      pressSequence('g', 'a');
      expect(onAgents).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a participating scope unmounts', () => {
    it('does not transfer its prefix to the shadowed parent', () => {
      const onGlobal = vi.fn();
      const onScoped = vi.fn();
      const App = ({ scoped }: { scoped: boolean }) => (
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+t': onGlobal }} />
          {scoped && (
            <KeyboardScope>
              <Shortcuts bindings={{ 'g$+t': onScoped }} />
            </KeyboardScope>
          )}
        </KeyboardShortcutsProvider>
      );
      const { rerender } = render(<App scoped />);
      pressKey('g');
      rerender(<App scoped={false} />);
      pressKey('t');
      expect(onGlobal).not.toHaveBeenCalled();
      expect(onScoped).not.toHaveBeenCalled();
      pressSequence('g', 't');
      expect(onGlobal).toHaveBeenCalledTimes(1);
    });
  });

  describe('when an independent participating hook unmounts', () => {
    it('preserves the remaining sequence and its updated callback', () => {
      const onOld = vi.fn();
      const onLatest = vi.fn();
      const App = ({ other, handler }: { other: boolean; handler: () => void }) => (
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': handler }} />
          {other && <Shortcuts bindings={{ 'g$+t': vi.fn() }} />}
        </KeyboardShortcutsProvider>
      );
      const { rerender } = render(<App other handler={onOld} />);
      pressKey('g');
      rerender(<App other={false} handler={onLatest} />);
      pressKey('a');
      expect(onLatest).toHaveBeenCalledTimes(1);
      expect(onOld).not.toHaveBeenCalled();
    });
  });

  describe('when the provider mounts in StrictMode', () => {
    it('runs a sequence once and clears its pending timer on unmount', () => {
      const onAgents = vi.fn();
      const { unmount } = render(
        <StrictMode>
          <KeyboardShortcutsProvider>
            <Shortcuts bindings={{ 'g$+a': onAgents }} />
          </KeyboardShortcutsProvider>
        </StrictMode>,
      );
      pressSequence('g', 'a');
      expect(onAgents).toHaveBeenCalledTimes(1);
      pressKey('g');
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      pressKey('a');
      expect(onAgents).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a child consumes a combo', () => {
    it('does not execute the global action', () => {
      const onGlobal = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'ctrl+k': onGlobal }} />
          <button onKeyDown={event => event.preventDefault()}>Local control</button>
        </KeyboardShortcutsProvider>,
      );
      fireEvent.keyDown(screen.getByRole('button'), { key: 'k', ctrlKey: true });
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('when a child consumes a sequence prefix', () => {
    it('does not arm the global sequence', () => {
      const onGlobal = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onGlobal }} />
          <button
            onKeyDown={event => {
              if (event.key === 'g') event.preventDefault();
            }}
          >
            Local control
          </button>
        </KeyboardShortcutsProvider>,
      );
      fireEvent.keyDown(screen.getByRole('button'), { key: 'g' });
      pressKey('a');
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('when a child consumes a sequence continuation', () => {
    it('cancels the pending sequence rather than resuming on the next key', () => {
      const onGlobal = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onGlobal }} />
          <button onKeyDown={event => event.preventDefault()}>Local control</button>
        </KeyboardShortcutsProvider>,
      );
      pressKey('g');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
      pressKey('a');
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('when a keyboard event is composing', () => {
    it.each([false, true])('ignores combos and prefixes with ctrlKey=%s', ctrlKey => {
      const onGlobal = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onGlobal, 'ctrl+k': onGlobal, 'g$+a': onGlobal, 'ctrl+g$+a': onGlobal }} />
          <button>Local control</button>
        </KeyboardShortcutsProvider>,
      );
      const target = screen.getByRole('button');
      expect(fireEvent.keyDown(target, { key: 'k', ctrlKey, isComposing: true })).toBe(true);
      expect(fireEvent.keyDown(target, { key: 'g', ctrlKey, isComposing: true })).toBe(true);
      pressKey('a');
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('when composition interrupts a pending sequence', () => {
    it('requires a fresh sequence after composition ends', () => {
      const onGlobal = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onGlobal }} />
          <button>Local control</button>
        </KeyboardShortcutsProvider>,
      );
      pressKey('g');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'a', isComposing: true });
      pressKey('a');
      expect(onGlobal).not.toHaveBeenCalled();
      pressSequence('g', 'a');
      expect(onGlobal).toHaveBeenCalledTimes(1);
    });
  });

  describe('given a global "g$+t" and a scoped page also binding "g$+t"', () => {
    const renderApp = (showPage: boolean, onGlobal: () => void, onPage: () => void) =>
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+t': onGlobal }} />
          {showPage ? (
            <Page>
              <Shortcuts bindings={{ 'g$+t': onPage }} />
            </Page>
          ) : null}
        </KeyboardShortcutsProvider>,
      );

    it('when g then t, then only the page handler fires', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      renderApp(true, onGlobal, onPage);

      pressSequence('g', 't');

      expect(onPage).toHaveBeenCalledTimes(1);
      expect(onGlobal).not.toHaveBeenCalled();
    });

    it('when the page unmounts, then the global handler takes over', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      const { rerender } = renderApp(true, onGlobal, onPage);

      rerender(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+t': onGlobal }} />
        </KeyboardShortcutsProvider>,
      );
      pressSequence('g', 't');

      expect(onGlobal).toHaveBeenCalledTimes(1);
      expect(onPage).not.toHaveBeenCalled();
    });

    it('when the page loads first (child effects run before parent), then the page still wins', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      renderApp(true, onGlobal, onPage);

      pressSequence('g', 't');

      expect(onPage).toHaveBeenCalledTimes(1);
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('given a scoped page whose shortcuts are disabled', () => {
    it('when g then t, then the global handler fires', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+t': onGlobal }} />
          <Page>
            <Shortcuts bindings={{ 'g$+t': onPage }} options={{ enabled: false }} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      pressSequence('g', 't');

      expect(onGlobal).toHaveBeenCalledTimes(1);
      expect(onPage).not.toHaveBeenCalled();
    });
  });

  describe('given global {g$+a, g$+t} and a scoped page {g$+t}', () => {
    const renderApp = (onAgents: () => void, onGlobalTraces: () => void, onPageTraces: () => void) =>
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'g$+a': onAgents, 'g$+t': onGlobalTraces }} />
          <Page>
            <Shortcuts bindings={{ 'g$+t': onPageTraces }} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

    it('when g then a, then the global agents handler fires', () => {
      const onAgents = vi.fn();
      const onGlobalTraces = vi.fn();
      const onPageTraces = vi.fn();
      renderApp(onAgents, onGlobalTraces, onPageTraces);

      pressSequence('g', 'a');

      expect(onAgents).toHaveBeenCalledTimes(1);
      expect(onGlobalTraces).not.toHaveBeenCalled();
      expect(onPageTraces).not.toHaveBeenCalled();
    });

    it('when g then t, then the page traces handler fires', () => {
      const onAgents = vi.fn();
      const onGlobalTraces = vi.fn();
      const onPageTraces = vi.fn();
      renderApp(onAgents, onGlobalTraces, onPageTraces);

      pressSequence('g', 't');

      expect(onPageTraces).toHaveBeenCalledTimes(1);
      expect(onGlobalTraces).not.toHaveBeenCalled();
      expect(onAgents).not.toHaveBeenCalled();
    });

    it('when g then t after the window expires, then nothing fires', () => {
      const onAgents = vi.fn();
      const onGlobalTraces = vi.fn();
      const onPageTraces = vi.fn();
      renderApp(onAgents, onGlobalTraces, onPageTraces);

      pressKey('g');
      vi.advanceTimersByTime(500);
      pressKey('t');

      expect(onPageTraces).not.toHaveBeenCalled();
      expect(onGlobalTraces).not.toHaveBeenCalled();
    });
  });

  describe('given two hooks at the same depth binding "k"', () => {
    it('when k is pressed, then the last mounted handler fires', () => {
      const onFirst = vi.fn();
      const onSecond = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onFirst }} />
          <Shortcuts bindings={{ k: onSecond }} />
        </KeyboardShortcutsProvider>,
      );

      pressKey('k');

      expect(onSecond).toHaveBeenCalledTimes(1);
      expect(onFirst).not.toHaveBeenCalled();
    });

    it('when the last mounted hook unmounts, then the first handler fires again', () => {
      const onFirst = vi.fn();
      const onSecond = vi.fn();
      const { rerender } = render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onFirst }} />
          <Shortcuts bindings={{ k: onSecond }} />
        </KeyboardShortcutsProvider>,
      );

      rerender(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onFirst }} />
        </KeyboardShortcutsProvider>,
      );
      pressKey('k');

      expect(onFirst).toHaveBeenCalledTimes(1);
      expect(onSecond).not.toHaveBeenCalled();
    });
  });

  describe('given three nested scopes binding "k"', () => {
    it('when k is pressed, then the deepest handler fires', () => {
      const onRoot = vi.fn();
      const onMiddle = vi.fn();
      const onDeep = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onRoot }} />
          <KeyboardScope>
            <Shortcuts bindings={{ k: onMiddle }} />
            <KeyboardScope>
              <Shortcuts bindings={{ k: onDeep }} />
            </KeyboardScope>
          </KeyboardScope>
        </KeyboardShortcutsProvider>,
      );

      pressKey('k');

      expect(onDeep).toHaveBeenCalledTimes(1);
      expect(onMiddle).not.toHaveBeenCalled();
      expect(onRoot).not.toHaveBeenCalled();
    });
  });

  describe('given a global "cmd+k" and a scoped "meta+k"', () => {
    it('when meta+k is pressed, then only the scoped handler fires', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ 'cmd+k': onGlobal }} />
          <Page>
            <Shortcuts bindings={{ 'meta+k': onPage }} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      pressKey('k', { metaKey: true });

      expect(onPage).toHaveBeenCalledTimes(1);
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('given a scoped page whose shouldHandle rejects the event', () => {
    it('when k is pressed, then the event is untouched and the global does not take over', () => {
      const onGlobal = vi.fn();
      const onPage = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onGlobal }} />
          <Page>
            <Shortcuts bindings={{ k: onPage }} options={{ shouldHandle: () => false }} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      const notPrevented = pressKey('k');

      expect(notPrevented).toBe(true);
      expect(onPage).not.toHaveBeenCalled();
      expect(onGlobal).not.toHaveBeenCalled();
    });
  });

  describe('given a hook with a target ref under the provider', () => {
    const Scoped = ({ onHit }: { onHit: () => void }) => {
      const ref = useRef<HTMLDivElement | null>(null);
      useKeydown({ k: onHit }, { target: ref });
      return (
        <div ref={ref}>
          <button data-testid="inside">inside</button>
        </div>
      );
    };

    it('when k is consumed inside the target, then only the target handler fires', () => {
      const onGlobal = vi.fn();
      const onTarget = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onGlobal }} />
          <Page>
            <Scoped onHit={onTarget} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      fireEvent.keyDown(screen.getByTestId('inside'), { key: 'k' });

      expect(onTarget).toHaveBeenCalledTimes(1);
      expect(onGlobal).not.toHaveBeenCalled();
    });

    it('when k is pressed on window, then only the global handler fires', () => {
      const onGlobal = vi.fn();
      const onTarget = vi.fn();
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: onGlobal }} />
          <Page>
            <Scoped onHit={onTarget} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      pressKey('k');

      expect(onGlobal).toHaveBeenCalledTimes(1);
      expect(onTarget).not.toHaveBeenCalled();
    });
  });

  describe('given a mounted provider', () => {
    it('when it unmounts, then the window listener is removed', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ k: vi.fn() }} />
        </KeyboardShortcutsProvider>,
      );

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });

    it('when several hooks register, then a single window listener is attached', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      render(
        <KeyboardShortcutsProvider>
          <Shortcuts bindings={{ a: vi.fn() }} />
          <Shortcuts bindings={{ b: vi.fn() }} />
          <Page>
            <Shortcuts bindings={{ c: vi.fn() }} />
          </Page>
        </KeyboardShortcutsProvider>,
      );

      const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === 'keydown');
      expect(keydownRegistrations).toHaveLength(1);
      addSpy.mockRestore();
    });
  });
});
