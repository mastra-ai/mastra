import { useEffect } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { useFilterBarContext } from './filter-bar-context';
import type { FilterBarItem } from './types';

// Popups (a segment's editor, a menu) are portaled out of the item but still bubble React
// events through it; only keys pressed on the item itself navigate it.
function isOutside(root: HTMLElement | null, target: EventTarget | null) {
  return !(target instanceof Node && root?.contains(target));
}

/**
 * An item's place in the bar's keyboard order, shared by every control the bar renders for an
 * item (a chip, the time range): registers whether the input's Backspace may remove it, and moves
 * focus with the arrows across the item's segments and on to its neighbours. Put `onKeyDown` on
 * the element `rootRef` points at.
 */
export function useFilterBarItemKeys({
  item,
  rootRef,
  pinned,
  removable,
  inert = false,
  segmentSelector = '[data-filter-bar-segment]',
}: {
  item: FilterBarItem;
  rootRef: RefObject<HTMLElement | null>;
  /** Never removed by the input's Backspace or by Clear. */
  pinned: boolean;
  /** Backspace / Delete on the item removes it. */
  removable: boolean;
  /** Ignore keys entirely (a draft, a read-only or a leaving chip). */
  inert?: boolean;
  /** The item's focusable segments, in order, inside `rootRef`. */
  segmentSelector?: string;
}) {
  const ctx = useFilterBarContext();
  const index = ctx.items.findIndex(i => i.id === item.id);

  const { registerNonRemovable } = ctx;
  useEffect(() => {
    registerNonRemovable(item.id, pinned);
    return () => registerNonRemovable(item.id, false);
  }, [registerNonRemovable, item.id, pinned]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (inert || isOutside(rootRef.current, event.target)) return;
    const segments = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(segmentSelector) ?? []);
    const current = segments.findIndex(el => el === event.target);

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        const next = segments[current + 1];
        if (next) next.focus();
        else if (!ctx.focusChip(index + 1, 1, 'field')) ctx.focusInput();
        return;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const prev = segments[current - 1];
        if (prev) prev.focus();
        else ctx.focusChip(index - 1, -1, 'remove');
        return;
      }
      case 'Delete':
      case 'Backspace':
        if (!removable) return;
        event.preventDefault();
        ctx.removeItem(item.id);
        ctx.focusAfterRemove(index);
        break;
      default:
    }
  };

  return { index, onKeyDown };
}
