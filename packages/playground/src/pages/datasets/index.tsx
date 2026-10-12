import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useDatasets } from '@mastra/react/hooks/datasets';
import { Navigate, useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { NoDatasetsInfo } from '@/domains/datasets/components/no-datasets-info';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/datasets')];

/** The sidebar lists every dataset, so the collection opens the first one. */
export default function Datasets() {
  const { data, isLoading, error } = useDatasets();
  const navigate = useNavigate();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load datasets" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (isLoading || !data) return null;

  const [firstDataset] = data.datasets;
  if (!firstDataset) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <NoDatasetsInfo onCreateClick={() => void navigate('/datasets/new')} />
      </PageLayout>
    );
  }
  return <Navigate to={`/datasets/${encodeURIComponent(firstDataset.id)}`} replace />;
}
