import { useParams, useSearchParams, Link } from 'react-router';
import { Database, GitCompare, ArrowLeft } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  Breadcrumb,
  Crumb,
  MainHeader,
  DatasetExperimentsComparison,
  useDataset,
} from '@mastra/playground-ui';

function CompareDatasetExperimentsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dataset } = useDataset(datasetId ?? '');
  const experimentIdA = searchParams.get('baseline') ?? '';
  const experimentIdB = searchParams.get('contender') ?? '';

  if (!datasetId || !experimentIdA || !experimentIdB) {
    return (
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to="/datasets">
              <Icon>
                <Database />
              </Icon>
              Datasets
            </Crumb>
            <Crumb isCurrent as="span">
              <Icon>
                <GitCompare />
              </Icon>
              Compare Experiments
            </Crumb>
          </Breadcrumb>
        </Header>
        <MainContentContent>
          <div className="text-neutral4 text-center py-8">
            <p>Select two experiments to compare.</p>
            <p className="text-sm mt-2">
              Use the URL format: /datasets/{'{datasetId}'}/experiments?baseline={'{experimentIdA}'}&contender=
              {'{experimentIdB}'}
            </p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/datasets">
            <Icon>
              <Database />
            </Icon>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            {dataset?.name ?? datasetId?.slice(0, 8)}
          </Crumb>
          <Crumb isCurrent as="span">
            <Icon>
              <GitCompare />
            </Icon>
            Experiments Comparison
          </Crumb>
        </Breadcrumb>
      </Header>

      <MainContentContent>
        <div className="max-w-[100rem] w-full px-12 mx-auto grid content-start ">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <GitCompare /> Dataset Experiments Comparison
              </MainHeader.Title>
              <MainHeader.Description>
                Comparing{' '}
                <Link to={`/datasets/${datasetId}/experiments/${experimentIdA}`}>{experimentIdA.slice(0, 8)}</Link> vs{' '}
                <Link to={`/datasets/${datasetId}/experiments/${experimentIdB}`}>{experimentIdB.slice(0, 8)}</Link>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <Button as={Link} to={`/datasets/${datasetId}`} variant="standard" size="default">
                <ArrowLeft />
                Back to Dataset
              </Button>
            </MainHeader.Column>
          </MainHeader>

          <DatasetExperimentsComparison
            datasetId={datasetId}
            experimentIdA={experimentIdA}
            experimentIdB={experimentIdB}
            onSwap={() => {
              setSearchParams({ baseline: experimentIdB, contender: experimentIdA });
            }}
          />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { CompareDatasetExperimentsPage };
export default CompareDatasetExperimentsPage;
