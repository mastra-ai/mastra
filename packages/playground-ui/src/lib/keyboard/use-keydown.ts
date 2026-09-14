import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  createKeyboardDispatcher,
  isKeyboardConsumer,
  matchesCombo,
  parseKeyCombo,
  type KeyboardLayer,
  type ParsedKeyCombo,
  type UseKeydownArgs,
} from './keyboard-dispatcher';
import { useKeyboardScopeDepth, useKeyboardShortcutsContext } from './keyboard-shortcuts-context';

export { parseKeyCombo, parseKeyBinding, matchesCombo } from './keyboard-dispatcher';
export type { UseKeydownArgs, KeyStep, ParsedKeyBinding } from './keyboard-dispatcher';

export type UseKeydownOptions = {
  /** Attach the listener to this element instead of `window`. */
  target?: RefObject<HTMLElement | null>;
  /** When `false`, no listener is attached. Defaults to `true`. */
  enabled?: boolean;
  /**
   * Called before any combo is matched. Return `false` to leave the event
   * untouched (no `preventDefault`, no handler). Runs on top of the built-in
   * rule that ignores unmodified keys coming from editable fields and keyboard
   * widgets (see `isKeyboardConsumer`).
   */
  shouldHandle?: (event: KeyboardEvent) => boolean;
};

/**
 * Binds keyboard shortcuts (see `UseKeydownArgs` for the syntax).
 *
 * Inside a `KeyboardShortcutsProvider`, bindings join a shared registry: the
 * nearest `KeyboardScope` decides which declaration wins when several bind the
 * same keys, and bindings are dropped as soon as the component unmounts.
 * Without a provider, or with a `target`, the hook listens on its own and no
 * shadowing takes place.
 */
export const useKeydown = (opts: UseKeydownArgs, options: UseKeydownOptions = {}) => {
  const { enabled = true, target } = options;
  const shortcuts = useKeyboardShortcutsContext();
  const depth = useKeyboardScopeDepth();

  // Kept fresh on every render so the dispatcher always calls the latest handlers.
  const layerRef = useRef<KeyboardLayer>({ depth, bindings: opts, shouldHandle: options.shouldHandle });
  layerRef.current.bindings = opts;
  layerRef.current.shouldHandle = options.shouldHandle;
  layerRef.current.depth = depth;

  const shared = !target && shortcuts.status === 'ready' ? shortcuts.dispatcher : undefined;

  useEffect(() => {
    if (!enabled) return;
    if (shared) return shared.register(layerRef.current);

    const element: HTMLElement | Window | null = target ? (target.current ?? null) : window;
    if (!element) return;

    const dispatcher = createKeyboardDispatcher();
    const unregister = dispatcher.register(layerRef.current);
    const handleKeyDown = (event: Event) => {
      if (event instanceof KeyboardEvent) dispatcher.handleKeydown(event);
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      unregister();
      dispatcher.reset();
    };
  }, [enabled, target, shared]);
};

export type UseTableKeydownArgs = {
  /** Number of rows in the table. */
  count: number;
  /** The scroll/list container; keyboard shortcuts only fire when focus is inside it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Rows moved by PageUp/PageDown. Defaults to 10. */
  pageSize?: number;
  /** Initially active row index. Defaults to 0. */
  initialIndex?: number;
  /** Called when a row should be activated (for non-interactive rows). */
  onActivate?: (index: number) => void;
  /** Called with the next index before focus moves (e.g. virtualizer.scrollToIndex). */
  onNavigate?: (index: number) => void;
  /**
   * Also listen for ArrowUp/ArrowDown/PageUp/PageDown on `document`, so the
   * list can be navigated before any row has focus. Keys are ignored when the
   * event originates from an editable field, a keyboard widget (combobox, menu,
   * listbox…) or an open dialog/popover. Enable on at most one list per page.
   */
  global?: boolean;
};

export const useTableKeydown = ({
  count,
  containerRef,
  pageSize = 10,
  initialIndex = 0,
  onActivate,
  onNavigate,
  global = false,
}: UseTableKeydownArgs) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(count - 1, 0));

  const navigateTo = (index: number) => {
    const next = clamp(index);
    setActiveIndex(next);
    onNavigate?.(next);

    const rowElement = containerRef.current?.querySelector<HTMLElement>(`[data-row-index="${next}"]`);
    if (rowElement) {
      rowElement.focus();
      rowElement.scrollIntoView?.({ block: 'nearest' });
    }
  };

  const combos: Array<[ParsedKeyCombo, () => void]> = [
    [parseKeyCombo('mod+Home'), () => navigateTo(0)],
    [parseKeyCombo('mod+End'), () => navigateTo(count - 1)],
    [parseKeyCombo('ArrowUp'), () => navigateTo(activeIndex - 1)],
    [parseKeyCombo('ArrowDown'), () => navigateTo(activeIndex + 1)],
    [parseKeyCombo('PageUp'), () => navigateTo(activeIndex - pageSize)],
    [parseKeyCombo('PageDown'), () => navigateTo(activeIndex + pageSize)],
    [parseKeyCombo('Home'), () => navigateTo(0)],
    [parseKeyCombo('End'), () => navigateTo(count - 1)],
  ];

  // Handled at row level (not via a container listener) so keyboard nav works
  // even when the list mounts after the hook, e.g. inside a tab panel.
  const handleRowKeyDown = (event: { nativeEvent: KeyboardEvent; preventDefault: () => void }) => {
    for (const [combo, handler] of combos) {
      if (matchesCombo(event.nativeEvent, combo)) {
        event.preventDefault();
        handler();
        return;
      }
    }
  };

  // When focus is outside the list, the first ArrowUp/ArrowDown press lands on
  // the current row instead of skipping past it.
  const focusIsInList = () => containerRef.current?.contains(document.activeElement) ?? false;
  const step = (delta: number) => navigateTo(focusIsInList() ? activeIndex + delta : activeIndex);

  useKeydown(
    {
      ArrowUp: () => step(-1),
      ArrowDown: () => step(1),
      PageUp: () => navigateTo(activeIndex - pageSize),
      PageDown: () => navigateTo(activeIndex + pageSize),
    },
    {
      enabled: global,
      shouldHandle: event => !event.defaultPrevented && count > 0 && !isKeyboardConsumer(event.target),
    },
  );

  useEffect(() => {
    if (activeIndex >= count) {
      setActiveIndex(Math.max(count - 1, 0));
    }
  }, [activeIndex, count]);

  const getRowProps = (index: number) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    'data-row-index': index,
    onFocus: () => setActiveIndex(index),
    onKeyDown: handleRowKeyDown,
  });

  const getContainerProps = () => ({});

  return {
    activeIndex,
    setActiveIndex,
    activate: (index: number) => onActivate?.(index),
    getRowProps,
    getContainerProps,
  };
};
