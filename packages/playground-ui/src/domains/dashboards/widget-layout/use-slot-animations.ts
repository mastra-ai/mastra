import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** A slot's box, horizontally as a share of the layout's width so a window resize doesn't read as a move. */
type Box = { left: number; top: number; width: number };

function durationToken(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000 || 0;
}

/**
 * Spans only change by whole columns, so without help a widget jumps from one width to the next.
 * After each change of `layout`, every `[data-widget-slot]` glides from where it was painted to its
 * new place and width. A change landing mid-glide starts from the slot's current, in-between box.
 */
export function useSlotAnimations(container: RefObject<HTMLElement | null>, layout: unknown) {
  const boxes = useRef(new Map<string, Box>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const share = origin.width || 1;
    const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = durationToken('--duration-normal');
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--ease-out-custom').trim() || 'ease-out';
    const next = new Map<string, Box>();

    for (const slot of root.querySelectorAll<HTMLElement>('[data-widget-slot]')) {
      const id = slot.dataset.widgetSlot;
      if (!id) continue;
      const previous = boxes.current.get(id);

      // Mid-glide the slot is painted at its last box shifted by the running transform, at the running width.
      const running = slot.getAnimations();
      let from = previous && { ...previous, width: previous.width * share, left: previous.left * share };
      if (from && running.length > 0) {
        const style = getComputedStyle(slot);
        const shift = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
        from = { left: from.left + shift.e, top: from.top + shift.f, width: parseFloat(style.width) };
      }
      running.forEach(animation => animation.cancel());

      const rect = slot.getBoundingClientRect();
      const to = { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width };
      next.set(id, { left: to.left / share, top: to.top, width: to.width / share });

      if (!animate || !from) continue;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(from.width - to.width) < 1) continue;
      slot.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, width: `${from.width}px` },
          { transform: 'none', width: `${to.width}px` },
        ],
        { duration, easing },
      );
    }
    boxes.current = next;
  }, [container, layout]);
}
