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

    function allowNativeMenu(event: Event) {
      // A touch long-press can fire contextmenu after Base UI's long-press
      // timer opened the popup. That is still the first gesture.
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      // Base UI also prevents contextmenu on document. Stop propagation, but
      // leave the browser default intact; synthetic events cannot open it.
      event.stopImmediatePropagation();
      actions.current?.close();
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 2) return;
      // Keep a popup link under the pointer until contextmenu is dispatched.
      if (
        event.target instanceof Element &&
        event.target.closest('[data-slot="context-menu-content"], [data-slot="context-menu-sub-content"]')
      )
        return;
      event.stopImmediatePropagation();
      const controller = new AbortController();
      nativeGesture.current = controller;
      document.addEventListener('contextmenu', event => allowNativeMenu(event), {
        capture: true,
        once: true,
        signal: controller.signal,
      });
      // Remove the backdrop before the browser targets mousedown/contextmenu,
      // so right-clicking a link still offers the browser's link actions.
      flushSync(() => actions.current?.close());
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('contextmenu', allowNativeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('contextmenu', allowNativeMenu, true);
    };
  }, [open, actions]);
}
