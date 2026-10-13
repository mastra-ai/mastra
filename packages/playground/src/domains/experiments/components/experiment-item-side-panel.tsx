import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useEffect } from 'react';
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
  const { currentItemId } = useExperimentItemPanel();
  const { hasPanel, panelHandle } = useRouteSidePanel();
  const isMobile = useIsMobile();

  // The panel starts collapsed on a first visit; open it whenever an item is selected.
  // Deferred a frame so the resizable group has registered the panel.
  useEffect(() => {
    if (!currentItemId || !hasPanel) return;
    const frame = requestAnimationFrame(() => panelHandle.current?.expand());
    return () => cancelAnimationFrame(frame);
  }, [currentItemId, hasPanel, panelHandle]);

  if (isMobile) return <ExperimentItemPanel {...props} />;
  if (!currentItemId) return null;

  return (
    <RouteSidePanel owner="experiment-item">
      <ExperimentItemPanel {...props} variant="inline" />
    </RouteSidePanel>
  );
}
