import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { GitCompare, ArrowLeft } from 'lucide-react';
import { useParams, useSearchParams, Link } from 'react-router';
import { DatasetExperimentsComparison } from '@/domains/datasets';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

function CompareDatasetExperimentsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { error } = useDataset(datasetId ?? '');
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
