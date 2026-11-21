import { useExperimentItemPanel } from '@mastra/playground-ui/domains/experiments/context/experiment-item-panel-context';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { StudioExperimentItemPanel } from './studio-experiment-item-panel';
import type { StudioExperimentItemPanelProps } from './studio-experiment-item-panel';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

/**
 * Shows the selected experiment item in the route side panel, next to the
 * Studio frame. Mobile keeps the drawer, since the edge drawer can't be opened
 * programmatically.
 */
export function ExperimentItemSidePanel(props: Omit<StudioExperimentItemPanelProps, 'variant'>) {
  const { currentItemId, close } = useExperimentItemPanel();
  const isMobile = useIsMobile();
  useSelectedItemSidePanel(currentItemId, close);

  if (isMobile) return <StudioExperimentItemPanel {...props} />;
  if (!currentItemId) return null;

  return (
    <RouteSidePanel owner="experiment-item">
      <StudioExperimentItemPanel {...props} variant="inline" />
    </RouteSidePanel>
  );
}
