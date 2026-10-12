import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useDatasets } from '@mastra/react/hooks/datasets';
import { useParams } from 'react-router';

export function DatasetCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const { data, isLoading } = useDatasets();

  if (!datasetId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return data?.datasets?.find(d => d.id === datasetId)?.name ?? datasetId;
}
