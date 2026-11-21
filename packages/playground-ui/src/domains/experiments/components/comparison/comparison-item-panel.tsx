import type { DatasetItem } from '@mastra/client-js';
import { DatasetItemPanel } from '@/domains/datasets';
import { DataPanel } from '@/ds/components/DataPanel';

export interface ComparisonItemPanelProps {
  datasetId: string;
  /** Item opened from a comparison row; `undefined` closes the panel. */
  itemId?: string;
  item?: DatasetItem;
  isLoading: boolean;
  onClose: () => void;
}

/**
 * The dataset item behind a comparison row, in the same side panel as on the dataset page.
 * It stays mounted while closed so it animates in and out.
 */
export function ComparisonItemPanel({ datasetId, itemId, item, isLoading, onClose }: ComparisonItemPanelProps) {
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
