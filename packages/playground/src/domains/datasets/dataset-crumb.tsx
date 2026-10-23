import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useDataset } from '@mastra/react/hooks/datasets';
import { useParams, useSearchParams } from 'react-router';
import { DatasetCombobox } from './components/dataset-combobox';
import { DatasetVersions } from './components/dataset-versions';
import { useDatasetItemsUrlState } from './hooks/use-dataset-items-url-state';

export function DatasetCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  // Fetch the dataset itself: the paginated list may not contain it.
  const { data: dataset, isLoading } = useDataset({
    datasetId: datasetId ?? '',
    queryOptions: { enabled: Boolean(datasetId) },
  });

  if (!datasetId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return dataset?.name ?? datasetId;
}

export function DatasetSwitcher() {
  const { datasetId } = useParams<{ datasetId: string }>();
  if (!datasetId) return null;

  return <DatasetCombobox value={datasetId} {...crumbSwitcherTriggerProps} aria-label="Switch dataset" />;
}

export function DatasetVersionCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const { data: dataset, isLoading } = useDataset({
    datasetId: datasetId ?? '',
    queryOptions: { enabled: Boolean(datasetId) },
  });

  if (isLoading) return <CrumbSkeleton />;
  if (!dataset) return null;

  const latestVersion = dataset.version;
  return activeVersion == null || activeVersion === latestVersion ? `Latest (v${latestVersion})` : `v${activeVersion}`;
}

export function DatasetVersionSwitcher() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion, handleVersionChange } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const { data: dataset } = useDataset({
    datasetId: datasetId ?? '',
    queryOptions: { enabled: Boolean(datasetId) },
  });

  if (!datasetId) return null;

  return (
    <DatasetVersions
      datasetId={datasetId}
      value={activeVersion}
      onValueChange={handleVersionChange}
      currentVersion={dataset?.version}
      datasetCreatedAt={dataset?.createdAt}
      {...crumbSwitcherTriggerProps}
      aria-label="Switch dataset version"
    />
  );
}
