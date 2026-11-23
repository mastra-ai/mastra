import { useDataset } from '@mastra/react/hooks/datasets';
import type { ReactNode } from 'react';
import { DatasetBreadcrumbs } from './dataset-page';
import { EditDatasetForm } from './edit-dataset-form';
import { PermissionDenied } from '@/domains/auth/components/permission-denied';
import { SessionExpired } from '@/domains/auth/components/session-expired';
import { Crumb } from '@/ds/components/Breadcrumb';
import { Card } from '@/ds/components/Card';
import { EmptyState } from '@/ds/components/EmptyState';
import { MainHeader } from '@/ds/components/MainHeader';
import { PageLayout } from '@/ds/components/PageLayout';
import { IconServer1 } from '@/ds/icons/central/IconServer1';
import { is401UnauthorizedError, is403ForbiddenError } from '@/utils/errors';

export interface EditDatasetPageProps {
  datasetId: string;
  /** Where the "Datasets" crumb links to. */
  datasetsHref: string;
  /** Called after save or cancel; apps usually go back to the dataset. */
  onDone: () => void;
}

/** Full-page dataset editor shared by Studio and Platform. */
export function EditDatasetPage({ datasetId, datasetsHref, onDone }: EditDatasetPageProps) {
  const { data: dataset, error, isLoading } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });

  const shell = (content: ReactNode) => (
    <PageLayout
      variant="page"
      breadcrumbs={
        <DatasetBreadcrumbs datasetId={datasetId} datasetsHref={datasetsHref}>
          <Crumb as="span" isCurrent>
            Edit dataset
          </Crumb>
        </DatasetBreadcrumbs>
      }
    >
      <h1 className="sr-only">Edit dataset</h1>
      <div />
      <div className="flex h-full items-center justify-center">{content}</div>
    </PageLayout>
  );

  if (isLoading) return null;
  if (error && is401UnauthorizedError(error)) return shell(<SessionExpired />);
  if (error && is403ForbiddenError(error)) return shell(<PermissionDenied resource="datasets" />);
  if (error || !dataset) {
    return shell(
      <EmptyState
        tone="error"
        titleSlot="Failed to load dataset"
        descriptionSlot={error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
      />,
    );
  }

  return shell(
    <div className="w-full max-w-2xl overflow-y-auto px-4 py-5">
      <MainHeader className="mb-6 p-0">
        <MainHeader.Column>
          <MainHeader.Title>
            <IconServer1 /> Edit dataset
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
          onSuccess={onDone}
          onCancel={onDone}
        />
      </Card>
    </div>,
  );
}
