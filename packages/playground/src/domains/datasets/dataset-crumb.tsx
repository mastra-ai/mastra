import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useDatasets } from '@mastra/react/hooks';
import { useParams } from 'react-router';
import { DatasetCombobox } from './components/dataset-combobox';

export function DatasetCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const { data, isLoading } = useDatasets();

  if (!datasetId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return data?.datasets?.find(d => d.id === datasetId)?.name ?? datasetId;
}

export function DatasetSwitcher() {
  const { datasetId } = useParams<{ datasetId: string }>();
  if (!datasetId) return null;

  return <DatasetCombobox value={datasetId} {...crumbSwitcherTriggerProps} aria-label="Switch dataset" />;
}
