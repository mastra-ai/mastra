import { Card } from '@mastra/playground-ui/components/Card';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { isAuthError } from '@mastra/playground-ui/utils/errors';
import { DatabaseIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EditDatasetForm } from '@/domains/datasets/components/edit-dataset-form';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

function EditDatasetPageShell({ children }: { children?: ReactNode }) {
  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}

function EditDatasetPage() {
  const { datasetId } = useParams()! as { datasetId: string };
  const navigate = useNavigate();
  const { data: dataset, error, isLoading } = useDataset(datasetId);

  const goToDataset = () => void navigate(`/datasets/${datasetId}`);

  if (isLoading) return null;

  if (error && isAuthError(error)) {
    return (
      <EditDatasetPageShell>
        <QueryError error={error} resource="datasets" title="Failed to load datasets" />
      </EditDatasetPageShell>
    );
  }

  if (error || !dataset) {
    return (
      <EditDatasetPageShell>
        <QueryError error={error} title="Failed to load dataset" />
      </EditDatasetPageShell>
    );
  }

  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>
        <div className="w-full max-w-2xl overflow-y-auto px-6 py-8">
          <MainHeader className="mb-6 p-0">
            <MainHeader.Column>
              <MainHeader.Title>
                <DatabaseIcon /> Edit dataset
              </MainHeader.Title>
              <MainHeader.Description>{dataset.name}</MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>
          <Card className="p-6">
            <EditDatasetForm
              dataset={{
                id: dataset.id,
                name: dataset.name,
                description: dataset.description || '',
                targetType: dataset.targetType,
                inputSchema: dataset.inputSchema,
                groundTruthSchema: dataset.groundTruthSchema,
                requestContextSchema: dataset.requestContextSchema,
              }}
              onSuccess={goToDataset}
              onCancel={goToDataset}
            />
          </Card>
        </div>
      </PageLayout.MainArea>
    </PageLayout>
  );
}

export { EditDatasetPage };
export default EditDatasetPage;
