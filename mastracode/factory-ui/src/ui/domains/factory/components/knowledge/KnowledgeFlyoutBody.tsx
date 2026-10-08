import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import type { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeFlyoutProps } from './KnowledgeFlyout';
import { KnowledgeNodeDetails } from './KnowledgeNodeDetails';
export function KnowledgeFlyoutBody({
  query,
  ...handlers
}: { query: ReturnType<typeof useKnowledgeNode> } & Pick<
  KnowledgeFlyoutProps,
  'focusRecordId' | 'onSelectRecord' | 'onNodeRef' | 'onOpenThread'
>) {
  if (query.isPending)
    return (
      <div className="flex flex-col gap-4 p-4" role="status" aria-label="Loading knowledge node">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  if (query.isError)
    return (
      <div className="p-4">
        <Notice variant="destructive">Unable to load this knowledge node.</Notice>
      </div>
    );
  return <KnowledgeNodeDetails key={query.data.node.id} details={query.data} {...handlers} />;
}
