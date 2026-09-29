import { Card } from '@mastra/playground-ui/components/Card';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useDataset } from '@mastra/playground-ui/domains/datasets';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { DatabaseIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { EditDatasetForm } from '@/domains/datasets/components/edit-dataset-form';
import { datasetCrumb, navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/datasets'), datasetCrumb, { id: 'dataset-edit', label: 'Edit dataset' }];

function EditDatasetPageShell({ children }: { children?: ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Edit dataset</h1>
      <div />
      <div className="flex h-full items-center justify-center">{children}</div>
    </PageLayout>
  );
}

function EditDatasetPage() {
  const { datasetId } = useParams()! as { datasetId: string };
  const navigate = useNavigate();
  const { data: dataset, error, isLoading } = useDataset(datasetId);

  const goToDataset = () => void navigate(`/datasets/${datasetId}`);

  if (isLoading) return null;

  if (error && is401UnauthorizedError(error)) {
    return (
      <EditDatasetPageShell>
        <SessionExpired />
      </EditDatasetPageShell>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <EditDatasetPageShell>
        <PermissionDenied resource="datasets" />
      </EditDatasetPageShell>
    );
  }

  if (error || !dataset) {
    return (
      <EditDatasetPageShell>
        <EmptyState
          tone="error"
          titleSlot="Failed to load dataset"
          descriptionSlot={error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
        />
      </EditDatasetPageShell>
    );
  }

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Edit dataset</h1>
      <div />
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-2xl overflow-y-auto px-4 py-5">
          <MainHeader className="mb-6 p-0">
            <MainHeader.Column>
              <MainHeader.Title>
                <DatabaseIcon /> Edit dataset
              </MainHeader.Title>
              <MainHeader.Description>{dataset.name}</MainHeader.Description>
            </MainHeader.Column>
          </MainHeader>
          <Card className="p-4">
            <EditDatasetForm
              dataset={{
                id: dataset.id,
                name: dataset.name,
                description: dataset.description || '',
                inputSchema: dataset.inputSchema,
                groundTruthSchema: dataset.groundTruthSchema,
                requestContextSchema: dataset.requestContextSchema,
                scorerIds: dataset.scorerIds,
              }}
              onSuccess={goToDataset}
              onCancel={goToDataset}
            />
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

export { EditDatasetPage };
export default EditDatasetPage;
