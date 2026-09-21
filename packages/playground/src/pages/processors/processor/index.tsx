import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useParams, Navigate } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb, processorCrumb } from '@/domains/navigation/crumbs';
import { ProcessorPanel } from '@/domains/processors/components/processor-panel';
import { useProcessor } from '@/domains/processors/hooks/use-processors';

const crumbs = [navCrumb('/processors'), processorCrumb];

export function Processor() {
  const { processorId } = useParams();
  const { data: processor, isLoading, error } = useProcessor(processorId!);

  // 401 check - session expired
  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout {...pageHeaderProps(crumbs)} height="full">
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </PageLayout>
    );
  }

  // 403 check - permission denied for processors
  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout {...pageHeaderProps(crumbs)} height="full">
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="processors" />
        </div>
      </PageLayout>
    );
  }

  // If this is a workflow processor, redirect to the workflow graph UI
  if (!isLoading && processor?.isWorkflow) {
    return <Navigate to={`/workflows/${processorId}/graph`} replace />;
  }

  if (isLoading) {
    return (
      <PageLayout {...pageHeaderProps(crumbs)} height="full">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </PageLayout>
    );
  }

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full" className="grid-rows-[minmax(0,1fr)] p-0">
      <div className="h-full w-full overflow-y-hidden">
        <ProcessorPanel processorId={processorId!} />
      </div>
    </PageLayout>
  );
}
