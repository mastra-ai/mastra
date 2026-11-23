import { ComparisonItemPanel } from '@mastra/playground-ui/domains/experiments';
import { useDatasetItem } from '@mastra/react/hooks/datasets';

interface ComparisonDatasetItemPanelProps {
  datasetId: string;
  itemId?: string;
  onClose: () => void;
}

/** Loads the dataset item behind a comparison row into the shared item panel. */
export function ComparisonDatasetItemPanel({ datasetId, itemId, onClose }: ComparisonDatasetItemPanelProps) {
  const { data: item, isLoading } = useDatasetItem({
    datasetId,
    itemId: itemId ?? '',
    queryOptions: { enabled: Boolean(datasetId) && Boolean(itemId) },
  });
  return (
    <ComparisonItemPanel datasetId={datasetId} itemId={itemId} item={item} isLoading={isLoading} onClose={onClose} />
  );
}
