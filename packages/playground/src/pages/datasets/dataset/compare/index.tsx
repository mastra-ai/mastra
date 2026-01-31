import { useParams, useSearchParams, Link } from 'react-router';
import { Database, GitCompare, ArrowLeft } from 'lucide-react';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  Breadcrumb,
  Crumb,
  PageHeader,
  ComparisonView,
} from '@mastra/playground-ui';

function DatasetCompare() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const runIdA = searchParams.get('runA') ?? '';
  const runIdB = searchParams.get('runB') ?? '';

  if (!datasetId || !runIdA || !runIdB) {
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
            <Crumb isCurrent>
              <Icon>
                <GitCompare />
              </Icon>
              Compare Runs
            </Crumb>
          </Breadcrumb>
        </Header>
        <MainContentContent>
          <div className="text-neutral4 text-center py-8">
            <p>Select two runs to compare.</p>
            <p className="text-sm mt-2">
              Use the URL format: /datasets/{'{datasetId}'}/compare?runA={'{runIdA}'}&runB={'{runIdB}'}
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
            {datasetId?.slice(0, 8)}
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <GitCompare />
            </Icon>
            Compare Runs
          </Crumb>
        </Breadcrumb>
        <HeaderAction>
          <Button as={Link} to={`/datasets/${datasetId}`} variant="outline">
            <Icon>
              <ArrowLeft />
            </Icon>
            Back to Dataset
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <div className="max-w-[100rem] w-full px-12 mx-auto grid content-start gap-8">
          <PageHeader
            title="Compare Runs"
            description={`Comparing ${runIdA.slice(0, 8)} vs ${runIdB.slice(0, 8)}`}
            icon={<GitCompare />}
          />

          <ComparisonView datasetId={datasetId} runIdA={runIdA} runIdB={runIdB} />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { DatasetCompare };
export default DatasetCompare;
