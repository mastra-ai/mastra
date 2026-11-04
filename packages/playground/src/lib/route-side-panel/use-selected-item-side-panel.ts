import { useEffect, useEffectEvent, useRef } from 'react';
import { useRouteSidePanel } from './use-route-side-panel';

/**
 * Keeps the route side panel in sync with a URL-selected item: selecting an item
 * opens the panel, and collapsing the panel closes the item so the URL matches
 * what's on screen.
 */
export function useSelectedItemSidePanel(currentItemId: string | undefined, close: () => void) {
  const { hasPanel, isCollapsed, panelHandle } = useRouteSidePanel();
  // Set once the panel has been seen open, so its initial collapsed size isn't read as the user closing it.
  const wasExpandedRef = useRef(false);

  // The panel starts collapsed on a first visit; open it whenever an item is selected.
  // Deferred a frame so the resizable group has registered the panel.
  useEffect(() => {
    if (!currentItemId || !hasPanel) return;
    const frame = requestAnimationFrame(() => panelHandle.current?.expand());
    return () => cancelAnimationFrame(frame);
  }, [currentItemId, hasPanel, panelHandle]);

  const deselect = useEffectEvent(() => close());

  useEffect(() => {
    if (!hasPanel) {
      wasExpandedRef.current = false;
      return;
    }
    if (!isCollapsed) {
      wasExpandedRef.current = true;
      return;
    }
    if (!wasExpandedRef.current || !currentItemId) return;
    wasExpandedRef.current = false;
    // Mid-drag, unmounting the separator breaks the library's pointer capture, so wait for the release.
    if (!document.querySelector('[data-separator="active"]')) {
      deselect();
      return;
    }
    window.addEventListener('pointerup', deselect, { once: true });
    return () => window.removeEventListener('pointerup', deselect);
  }, [hasPanel, isCollapsed, currentItemId]);
}
