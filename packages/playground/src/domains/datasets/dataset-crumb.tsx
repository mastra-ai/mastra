import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { DatasetCombobox } from './components/dataset-combobox';
import { useDatasets } from './hooks/use-datasets';

/**
 * Dataset breadcrumb label. The route `to` makes it a link on nested routes;
 * the switcher lives in `DatasetSwitcherAction` (crumb `action` slot).
 */
export function DatasetCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const { data, isLoading } = useDatasets();

  if (!datasetId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return data?.datasets?.find(d => d.id === datasetId)?.name ?? datasetId;
}

export function DatasetSwitcherAction() {
  const { datasetId } = useParams<{ datasetId: string }>();
  if (!datasetId) return null;

  return <DatasetCombobox value={datasetId} variant="ghost" size="icon-sm" aria-label="Switch dataset" />;
}
