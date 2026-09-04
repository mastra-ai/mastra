import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { isAuthError } from '@mastra/playground-ui/utils/errors';
import { useParams, Navigate } from 'react-router';
import { ProcessorPanel } from '@/domains/processors/components/processor-panel';
import { useProcessor } from '@/domains/processors/hooks/use-processors';

export function Processor() {
  const { processorId } = useParams();
  const { data: processor, isLoading, error } = useProcessor(processorId!);

  if (error && isAuthError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <QueryError error={error} resource="processors" title="Failed to load processors" />
      </div>
    );
  }

  // If this is a workflow processor, redirect to the workflow graph UI
  if (!isLoading && processor?.isWorkflow) {
    return <Navigate to={`/workflows/${processorId}/graph`} replace />;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-hidden">
      <ProcessorPanel processorId={processorId!} />
    </div>
  );
}
