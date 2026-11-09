import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { ExperimentItemPanel } from './experiment-item-panel';
import type { ExperimentItemPanelProps } from './experiment-item-panel';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

/**
 * Shows the selected experiment item in the route side panel, next to the
 * Studio frame. Mobile keeps the drawer, since the edge drawer can't be opened
 * programmatically.
 */
export function ExperimentItemSidePanel(props: Omit<ExperimentItemPanelProps, 'variant'>) {
  const { currentItemId, close } = useExperimentItemPanel();
  const isMobile = useIsMobile();
  useSelectedItemSidePanel(currentItemId, close);

  if (isMobile) return <ExperimentItemPanel {...props} />;
  if (!currentItemId) return null;

  return (
    <RouteSidePanel owner="experiment-item">
      <ExperimentItemPanel {...props} variant="inline" />
    </RouteSidePanel>
  );
}
