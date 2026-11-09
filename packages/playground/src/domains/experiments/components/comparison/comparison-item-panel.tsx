import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useDatasetItem } from '@mastra/react/hooks/datasets';

import { DatasetItemPanel } from '@/domains/datasets/components/items/dataset-item-panel';

interface ComparisonItemPanelProps {
  datasetId: string;
  /** Item opened from a comparison row; `undefined` closes the panel. */
  itemId?: string;
  onClose: () => void;
}

/**
 * The dataset item behind a comparison row, in the same side panel as on the dataset page.
 * It stays mounted while closed so it animates in and out.
 */
export function ComparisonItemPanel({ datasetId, itemId, onClose }: ComparisonItemPanelProps) {
  const { data: item, isLoading } = useDatasetItem({
    datasetId,
    itemId: itemId ?? '',
    queryOptions: { enabled: Boolean(datasetId) && Boolean(itemId) },
  });
  return (
    <DatasetItemPanel
      datasetId={datasetId}
      item={item}
      itemId={itemId}
      fallback={
        isLoading ? <DataPanel.LoadingData /> : <DataPanel.NoData>Dataset item "{itemId}" not found.</DataPanel.NoData>
      }
      // Comparison rows aren't a navigable item list, so previous/next stay disabled.
      items={item ? [item] : []}
      onItemChange={() => {}}
      onClose={onClose}
    />
  );
}
