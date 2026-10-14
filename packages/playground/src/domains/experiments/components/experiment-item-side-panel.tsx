import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useEffect, useEffectEvent, useRef } from 'react';
import { ExperimentItemPanel } from './experiment-item-panel';
import type { ExperimentItemPanelProps } from './experiment-item-panel';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { RouteSidePanel, useRouteSidePanel } from '@/lib/route-side-panel';

/**
 * Shows the selected experiment item in the route side panel, next to the
 * Studio frame. Mobile keeps the drawer, since the edge drawer can't be opened
 * programmatically.
 */
export function ExperimentItemSidePanel(props: Omit<ExperimentItemPanelProps, 'variant'>) {
  const { currentItemId, close } = useExperimentItemPanel();
  const { hasPanel, isCollapsed, panelHandle } = useRouteSidePanel();
  const isMobile = useIsMobile();
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

  // Collapsing the panel closes the item, so the URL matches what's on screen.
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

  if (isMobile) return <ExperimentItemPanel {...props} />;
  if (!currentItemId) return null;

  return (
    <RouteSidePanel owner="experiment-item">
      <ExperimentItemPanel {...props} variant="inline" />
    </RouteSidePanel>
  );
}
