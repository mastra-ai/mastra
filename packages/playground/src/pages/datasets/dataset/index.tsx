import { Button } from '@mastra/playground-ui/components/Button';
import { DatasetPage as SharedDatasetPage, useDatasetItemsUrlState } from '@mastra/playground-ui/domains/datasets';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { useDataset, useDatasetItems } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import { Link, useMatch, useParams, useNavigate, useSearchParams } from 'react-router';
import { ExperimentTriggerDialog } from '@/domains/datasets';
import { DatasetItemSidePanel } from '@/domains/datasets/components/items/dataset-item-side-panel';

function DatasetPage() {
  const { datasetId } = useParams() as { datasetId: string };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentItemId = useMatch('/datasets/:datasetId/items/:itemId')?.params.itemId;
  const { activeVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);

  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  const { data: items = [] } = useDatasetItems({
    datasetId,
    search: undefined,
    version: activeVersion,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  const hasItems = items.length > 0;
  // A dataset that has been edited keeps versions (and possibly experiments) even once emptied.
  const showDataActions = hasItems || (dataset?.version ?? 0) > 0;

  return (
    <SharedDatasetPage
      datasetId={datasetId}
      currentItemId={currentItemId}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      datasetsHref="/datasets"
      onEdit={() => void navigate(`/datasets/${datasetId}/edit`)}
      onDeleted={() => void navigate('/datasets')}
      itemPanel={<DatasetItemSidePanel />}
      headerActionsStart={
        <>
          {hasItems && (
            <Button variant="ghost" size="sm" onClick={() => setExperimentDialogOpen(true)} icon={<IconPlusMedium />}>
              New experiment
            </Button>
          )}
          {showDataActions && (
            <Button
              variant="ghost"
              size="sm"
              render={<Link to={`/experiments?dataset=${datasetId}`} />}
              icon={<ExperimentsIcon />}
            >
              Experiments
            </Button>
          )}
        </>
      }
    >
      <ExperimentTriggerDialog
        key={`${datasetId}:${activeVersion ?? 'latest'}`}
        initialDatasetId={datasetId}
        initialDatasetVersion={activeVersion ?? undefined}
        open={experimentDialogOpen}
        onOpenChange={setExperimentDialogOpen}
        onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
      />
    </SharedDatasetPage>
  );
}

export { DatasetPage };
export default DatasetPage;
