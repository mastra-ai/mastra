import { useEffect, useEffectEvent, useState, type RefObject } from 'react';

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

export const matchesCombo = (event: KeyboardEvent, combo: ParsedKeyCombo): boolean =>
  event.metaKey === combo.meta &&
  event.ctrlKey === combo.ctrl &&
  event.shiftKey === combo.shift &&
  event.altKey === combo.alt &&
  event.key.toLowerCase() === combo.key;

export type UseKeydownOptions = {
  /** Attach the listener to this element instead of `window`. */
  target?: RefObject<HTMLElement | null>;
};

export const useKeydown = (opts: UseKeydownArgs, options: UseKeydownOptions = {}) => {
  const handlers = useEffectEvent((event: KeyboardEvent) => {
    for (const [combo, handler] of Object.entries(opts)) {
      if (matchesCombo(event, parseKeyCombo(combo))) {
        event.preventDefault();
        handler();
        return;
      }
    }
  });

  const hasTarget = Boolean(options.target);

  useEffect(() => {
    const element: HTMLElement | Window | null = hasTarget ? (options.target?.current ?? null) : window;
    if (!element) return;

    const handleKeyDown = (event: Event) => {
      handlers(event as KeyboardEvent);
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  });
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
};

export const useTableKeydown = ({
  count,
  containerRef,
  pageSize = 10,
  initialIndex = 0,
  onActivate,
  onNavigate,
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

  useKeydown(
    {
      ArrowUp: () => navigateTo(activeIndex - 1),
      ArrowDown: () => navigateTo(activeIndex + 1),
      PageUp: () => navigateTo(activeIndex - pageSize),
      PageDown: () => navigateTo(activeIndex + pageSize),
      Home: () => navigateTo(0),
      End: () => navigateTo(count - 1),
      'mod+Home': () => navigateTo(0),
      'mod+End': () => navigateTo(count - 1),
    },
    { target: containerRef },
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
