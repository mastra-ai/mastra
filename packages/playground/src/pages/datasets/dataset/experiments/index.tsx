import {
  Breadcrumb,
  Button,
  Crumb,
  Header,
  Icon,
  MainContentContent,
  MainContentLayout,
  MainHeader,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { Database, GitCompare, ArrowLeft } from 'lucide-react';
import { useParams, useSearchParams, Link } from 'react-router';
import { DatasetExperimentsComparison } from '@/domains/datasets';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

function CompareDatasetExperimentsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: dataset, error } = useDataset(datasetId ?? '');
  const experimentIdA = searchParams.get('baseline') ?? '';
  const experimentIdB = searchParams.get('contender') ?? '';

  if (error && is401UnauthorizedError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
        </div>
      </MainContentLayout>
    );
  }

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
              <Button as={Link} to={`/datasets/${datasetId}`}>
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
