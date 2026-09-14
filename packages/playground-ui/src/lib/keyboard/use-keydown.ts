import { useEffect, useEffectEvent, useState, type RefObject } from 'react';

/**
 * Map of key bindings to handlers.
 *
 * - Combos: `'cmd+k'`, `'ctrl+shift+p'`, `'mod+Home'`.
 * - Timed sequences: `'g$+a'` — press `g`, then `a` within 500ms.
 *   Chain as many steps as needed (`'a$+b$+c'`); the last step has no `$`.
 *   A sequence prefix takes precedence over a plain combo on the same key, and an
 *   unexpected key resets the sequence before being evaluated normally.
 */
export type UseKeydownArgs = {
  [keySet: string]: () => void;
};

type ParsedKeyCombo = {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
};

const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '');

export const parseKeyCombo = (combo: string): ParsedKeyCombo => {
  const parsed: ParsedKeyCombo = { meta: false, ctrl: false, shift: false, alt: false, key: '' };

  for (const token of combo.split('+')) {
    switch (token.toLowerCase()) {
      case 'cmd':
      case 'meta':
        parsed.meta = true;
        break;
      case 'ctrl':
      case 'control':
        parsed.ctrl = true;
        break;
      case 'shift':
        parsed.shift = true;
        break;
      case 'alt':
      case 'option':
        parsed.alt = true;
        break;
      case 'mod':
        if (isMacPlatform()) parsed.meta = true;
        else parsed.ctrl = true;
        break;
      default:
        parsed.key = token.toLowerCase();
    }
  }

  return parsed;
};

export type KeyStep = ParsedKeyCombo;

/** A binding is a sequence of steps; a plain combo is a sequence of length 1. */
export type ParsedKeyBinding = KeyStep[];

const SEQUENCE_TIMEOUT_MS = 500;
const SEQUENCE_TOKEN = /^(.+)\$$/;

/**
 * Parses `cmd+k` (single step) or `g$+a` (sequence: `g`, then `a` within 500ms).
 * A `key$` token closes a step; the modifiers before it belong to that step.
 */
export const parseKeyBinding = (binding: string): ParsedKeyBinding => {
  const steps: KeyStep[] = [];
  let tokens: string[] = [];

  for (const token of binding.split('+')) {
    const [, sequenceKey] = SEQUENCE_TOKEN.exec(token) ?? [];
    if (sequenceKey) {
      steps.push(parseKeyCombo([...tokens, sequenceKey].join('+')));
      tokens = [];
    } else {
      tokens.push(token);
    }
  }

  if (tokens.length === 0) {
    throw new Error(`Invalid key binding "${binding}": the last step cannot end with $`);
  }
  steps.push(parseKeyCombo(tokens.join('+')));

  for (const step of steps) {
    if (!step.key) throw new Error(`Invalid key binding "${binding}": every step needs a key`);
  }

  return steps;
};

/**
 * Printable symbols like `?`, `!` or `:` are typed with Shift on most layouts, and
 * `event.key` already reflects the resulting character. For those, the Shift state
 * is irrelevant unless the binding asks for it explicitly.
 */
const isShiftedSymbol = (key: string) => key.length === 1 && !/[a-z0-9]/i.test(key);

export const matchesCombo = (event: KeyboardEvent, combo: ParsedKeyCombo): boolean =>
  event.metaKey === combo.meta &&
  event.ctrlKey === combo.ctrl &&
  (event.shiftKey === combo.shift || (!combo.shift && isShiftedSymbol(combo.key))) &&
  event.altKey === combo.alt &&
  event.key.toLowerCase() === combo.key;

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

const KEYBOARD_CONSUMER_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true" i]',
  '[contenteditable="plaintext-only" i]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-radix-popper-content-wrapper]',
].join(', ');

const isKeyboardConsumer = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(KEYBOARD_CONSUMER_SELECTOR) !== null;

/**
 * Keys without meta/ctrl/alt (`?`, `g`, `Escape`, arrows…) belong to the
 * focused field or widget, so they must keep typing/navigating there. Combos
 * like `mod+k` are safe to intercept from anywhere.
 */
const isTypingInConsumer = (event: KeyboardEvent) =>
  !event.metaKey && !event.ctrlKey && !event.altKey && isKeyboardConsumer(event.target);

type PendingSequence = {
  /** Steps already matched, as parsed combos (several bindings may share a prefix). */
  matched: KeyStep[];
  expiresAt: number;
};

const sameCombo = (a: ParsedKeyCombo, b: ParsedKeyCombo) =>
  a.key === b.key && a.meta === b.meta && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt;

const hasPrefix = (steps: KeyStep[], prefix: KeyStep[]) =>
  steps.length > prefix.length && prefix.every((step, i) => sameCombo(steps[i] as KeyStep, step));

export const useKeydown = (opts: UseKeydownArgs, options: UseKeydownOptions = {}) => {
  const { enabled = true, target } = options;
  const [pending, setPending] = useState<PendingSequence | null>(null);

  const handlers = useEffectEvent((event: KeyboardEvent) => {
    if (isTypingInConsumer(event)) return;
    if (options.shouldHandle && !options.shouldHandle(event)) return;

    const bindings = Object.entries(opts).map(([binding, handler]) => ({
      binding,
      steps: parseKeyBinding(binding),
      handler,
    }));
    const now = Date.now();

    if (pending) {
      if (now < pending.expiresAt) {
        const stepIndex = pending.matched.length;
        for (const { steps, handler } of bindings) {
          const step = steps[stepIndex];
          if (!step || !hasPrefix(steps, pending.matched) || !matchesCombo(event, step)) continue;
          event.preventDefault();
          if (stepIndex === steps.length - 1) {
            setPending(null);
            handler();
          } else {
            setPending({ matched: [...pending.matched, step], expiresAt: now + SEQUENCE_TIMEOUT_MS });
          }
          return;
        }
      }
      // Expired or unexpected key: reset and evaluate the event normally below.
      setPending(null);
    }

    // Sequence prefixes win over plain combos on the same key.
    for (const { steps } of bindings) {
      const [first] = steps;
      if (steps.length > 1 && first && matchesCombo(event, first)) {
        event.preventDefault();
        setPending({ matched: [first], expiresAt: now + SEQUENCE_TIMEOUT_MS });
        return;
      }
    }

    for (const { steps, handler } of bindings) {
      const [first] = steps;
      if (steps.length === 1 && first && matchesCombo(event, first)) {
        event.preventDefault();
        handler();
        return;
      }
    }
  });

  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), Math.max(0, pending.expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [pending]);

  useEffect(() => {
    if (!enabled) return;
    const element: HTMLElement | Window | null = target ? (target.current ?? null) : window;
    if (!element) return;

    const handleKeyDown = (event: Event) => {
      handlers(event as KeyboardEvent);
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
      setPending(null);
    };
  }, [enabled, target]);
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
