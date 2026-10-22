import type { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';

/** A second right-click escapes the app menu, including its modal backdrop. */
export function useNativeContextMenu(open: boolean, actions: RefObject<ContextMenuPrimitive.Root.Actions | null>) {
  const nativeGesture = useRef<AbortController | null>(null);

  useEffect(() => () => nativeGesture.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    nativeGesture.current?.abort();
    const listeners = new AbortController();

    function allowNativeMenu(event: Event) {
      // A touch long-press fires contextmenu after Base UI already opened the menu: still the first gesture.
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      // Skips Base UI's document listener that prevents the native menu; the browser default stays intact.
      event.stopImmediatePropagation();
      actions.current?.close();
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 2 || isInsideMenuPopup(event.target)) return;
      event.stopImmediatePropagation();
      const gesture = new AbortController();
      nativeGesture.current = gesture;
      // On window: closing below tears down this effect's document listeners before contextmenu fires.
      window.addEventListener('contextmenu', allowNativeMenu, { capture: true, once: true, signal: gesture.signal });
      // The backdrop must be gone when the browser hit-tests contextmenu, or the native menu loses link actions.
      flushSync(() => actions.current?.close());
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true, signal: listeners.signal });
    document.addEventListener('contextmenu', allowNativeMenu, { capture: true, signal: listeners.signal });
    return () => listeners.abort();
  }, [open, actions]);
}

/** A right-click on a popup item keeps it under the pointer, so a link item gets the browser's link actions. */
function isInsideMenuPopup(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-slot="context-menu-content"], [data-slot="context-menu-sub-content"]') !== null
  );
}
