import {
  Breadcrumb,
  Crumb,
  Header,
  MainContentLayout,
  Icon,
  HeaderAction,
  Button,
  DatasetSettings,
  useDataset,
} from '@mastra/playground-ui';
import { DatabaseIcon } from 'lucide-react';
import { useParams, Link } from 'react-router';

export default function NewDatasetsPage() {
  const { datasetId } = useParams()! as { datasetId: string };
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(datasetId);

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/scorers`}>
            <Icon>
              <DatabaseIcon />
            </Icon>
            Datasets
          </Crumb>

          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            {dataset?.name}
          </Crumb>

          <Crumb as={Link} to={`/datasets/new`} isCurrent>
            Settings
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/datasets/overview" target="_blank">
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <DatasetSettings datasetId={datasetId} />
    </MainContentLayout>
  );
}
