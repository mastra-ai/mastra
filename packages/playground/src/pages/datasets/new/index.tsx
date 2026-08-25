import { Card } from '@mastra/playground-ui/components/Card';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { DatabaseIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { CreateDatasetForm } from '@/domains/datasets/components/create-dataset-form';
import { isDatasetTargetType } from '@/domains/datasets/components/target-type-options';

function CreateDatasetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const targetTypeParam = searchParams.get('targetType');
  const targetType = isDatasetTargetType(targetTypeParam) ? targetTypeParam : undefined;
  const targetIdsParam = searchParams.get('targetIds');
  const targetIds =
    targetType && targetIdsParam
      ? targetIdsParam
          .split(',')
          .map(id => id.trim())
          .filter(Boolean)
      : undefined;

  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>
        <div className="w-full max-w-2xl overflow-y-auto px-6 py-8">
          <MainHeader className="mb-6 p-0">
            <MainHeader.Column>
              <MainHeader.Title>
                <DatabaseIcon /> Create new dataset
              </MainHeader.Title>
              <MainHeader.Description>
                Datasets group test cases used to evaluate your agents and workflows.
              </MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>
          <Card className="p-6">
            <CreateDatasetForm
              targetType={targetType}
              targetIds={targetIds}
              onSuccess={datasetId => void navigate(`/datasets/${datasetId}`)}
              onCancel={() => void navigate(-1)}
            />
          </Card>
        </div>
      </PageLayout.MainArea>
    </PageLayout>
  );
}

export { CreateDatasetPage };
export default CreateDatasetPage;
