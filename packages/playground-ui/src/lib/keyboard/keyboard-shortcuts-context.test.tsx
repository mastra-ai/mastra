// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
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

    it('when k is pressed inside the target, then both the target and the global handler fire', () => {
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
      expect(onGlobal).toHaveBeenCalledTimes(1);
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
