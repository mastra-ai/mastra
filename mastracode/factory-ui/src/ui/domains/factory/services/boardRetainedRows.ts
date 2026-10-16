import type { RefObject } from 'react';

/** Subscribe to browser-owned interaction state outside React's render path.
 * Retain keys, not positions: sorting must not unmount a card with a draft. */
export function boardRetainedRows(contentRef: RefObject<HTMLDivElement | null>) {
  let snapshot: readonly string[] = [];

  return {
    getSnapshot: () => snapshot,
    subscribe: (onChange: () => void) => {
      const content = contentRef.current;
      if (!content) return () => {};
      let draggingKey: string | undefined;

      const update = () => {
        const next: string[] = [];
        for (const row of content.querySelectorAll<HTMLElement>('[data-item-key]')) {
          const key = row.dataset.itemKey;
          if (key === undefined) continue;
          const interacting =
            key === draggingKey ||
            row.contains(content.ownerDocument.activeElement) ||
            row.querySelector('[aria-expanded="true"]') !== null;
          if (interacting) next.push(key);
        }
        if (next.length === snapshot.length && next.every((key, index) => key === snapshot[index])) return;
        snapshot = next;
        onChange();
      };
      const startDrag = (event: DragEvent) => {
        if (!(event.target instanceof Element)) return;
        draggingKey = event.target.closest<HTMLElement>('[data-item-key]')?.dataset.itemKey;
        update();
      };
      const endDrag = () => {
        draggingKey = undefined;
        update();
      };
      const observer = new MutationObserver(update);
      observer.observe(content, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['aria-expanded', 'data-item-key'],
      });
      content.addEventListener('focusin', update);
      content.addEventListener('focusout', update);
      content.addEventListener('dragstart', startDrag);
      content.addEventListener('dragend', endDrag);
      update();

      return () => {
        observer.disconnect();
        content.removeEventListener('focusin', update);
        content.removeEventListener('focusout', update);
        content.removeEventListener('dragstart', startDrag);
        content.removeEventListener('dragend', endDrag);
      };
    },
  };
}
