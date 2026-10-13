import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';

import { ExperimentItemPanel } from '@/domains/experiments/components/experiment-item-panel';
import type { ExperimentItemPanelProps } from '@/domains/experiments/components/experiment-item-panel';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { RouteSidePanel } from '@/lib/route-side-panel';

/**
 * Hosts the item result inline in the route side panel, next to the Studio frame, on desktop.
 * The panel exists only while an item is selected and can't be collapsed shut: closing the
 * item is what removes it. On mobile the result keeps its drawer: the edge drawer can't auto-open.
 */
export function ExperimentItemSidePanel(props: Omit<ExperimentItemPanelProps, 'variant'>) {
  const { currentItemId } = useExperimentItemPanel();
  const isMobile = useIsMobile();

  if (isMobile) return <ExperimentItemPanel {...props} />;
  if (!currentItemId) return null;

  return (
    <RouteSidePanel owner="experiment-item" collapsible={false} minSize={480}>
      <ExperimentItemPanel {...props} variant="inline" />
    </RouteSidePanel>
  );
}
