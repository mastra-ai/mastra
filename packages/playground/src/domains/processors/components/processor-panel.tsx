import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useProcessor } from '@mastra/react/hooks/processors';
import { ProcessorExecution } from './processor-execution';

export function ProcessorPanel({ processorId }: { processorId: string }) {
  const { data: processor, isLoading, error } = useProcessor({ processorId });
  if (isLoading) return <Skeleton className="m-4 h-32" />;
  if (error)
    return (
      <EmptyState variant="fill" tone="error" titleSlot="Unable to load processor" descriptionSlot={error.message} />
    );
  if (!processor) return <EmptyState variant="fill" titleSlot="Processor not found" />;
  return <ProcessorExecution key={processor.id} processor={processor} />;
}
