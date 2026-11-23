import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useProcessor } from '@mastra/react/hooks/processors';
import { useParams, Navigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb, processorCrumb } from '@/domains/navigation/crumbs';
import { ProcessorPanel } from '@/domains/processors/components/processor-panel';

const crumbs = [navCrumb('/processors'), processorCrumb];

export function Processor() {
  const { processorId } = useParams();
  const {
    data: processor,
    isLoading,
    error,
  } = useProcessor({ processorId: processorId!, queryOptions: { enabled: !!processorId } });

  const authError = is401UnauthorizedError(error) || is403ForbiddenError(error);

  // If this is a workflow processor, redirect to the workflow graph UI
  if (!isLoading && !authError && processor?.isWorkflow) {
    return <Navigate to={`/workflows/${processorId}/graph`} replace />;
  }

  const ready = !isLoading && !error;

  return (
    <PageLayout variant="page" body={ready ? 'fixed' : 'scroll'} breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">{processorId}</h1>
      <ProcessorBody processorId={processorId!} isLoading={isLoading} error={error} />
    </PageLayout>
  );
}

function ProcessorBody({ processorId, isLoading, error }: { processorId: string; isLoading: boolean; error: unknown }) {
  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return <SessionExpired variant="fill" />;
  }

  // 403 check - permission denied for processors
  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied variant="fill" resource="processors" />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-hidden">
      <ProcessorPanel processorId={processorId} />
    </div>
  );
}
