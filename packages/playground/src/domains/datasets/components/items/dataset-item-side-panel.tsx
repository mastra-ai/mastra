import {
  DatasetItemSidePanel as SharedDatasetItemSidePanel,
  useDatasetItemPanel,
} from '@mastra/playground-ui/domains/datasets';
import { RouteSidePanel, useSelectedItemSidePanel } from '@/lib/route-side-panel';

/** Puts the shared dataset item panel in the Studio frame's route side panel. */
export function DatasetItemSidePanel() {
  const { currentItemId, close } = useDatasetItemPanel();
  useSelectedItemSidePanel(currentItemId, close);
  return (
    <SharedDatasetItemSidePanel renderInline={panel => <RouteSidePanel owner="dataset-item">{panel}</RouteSidePanel>} />
  );
}
