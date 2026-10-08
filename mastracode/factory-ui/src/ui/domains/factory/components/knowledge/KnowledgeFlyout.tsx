import { Txt } from '@mastra/playground-ui/components/Txt';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Button } from '@mastra/playground-ui/components/Button';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { X } from 'lucide-react';
import { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import { KnowledgeRungBadge as RungBadge } from './KnowledgeRungBadge';
import { KnowledgeNodeDetails } from './KnowledgeNodeDetails';

export interface KnowledgeFlyoutProps {
  factoryProjectId: string;
  nodeId: string;
  nodeName: string;
  threadId?: string;
  /** Highlight the knowledge record backing a clicked edge. */
  focusRecordId?: string;
  /** Card expand/collapse selects (or clears) the knowledge record page-wide — the graph lights it up too. */
  onSelectRecord?: (recordId: string | null) => void;
  onClose: () => void;
  onNodeRef?: (name: string) => void;
  onOpenThread?: (threadId: string) => void;
}

export function KnowledgeFlyout({
  factoryProjectId,
  nodeId,
  nodeName,
  threadId,
  focusRecordId,
  onSelectRecord,
  onClose,
  onNodeRef,
  onOpenThread,
}: KnowledgeFlyoutProps) {
  const nodeQuery = useKnowledgeNode(factoryProjectId, nodeId, threadId);

  return (
    <>
      <header className="flex h-20 shrink-0 items-start gap-2 px-4 py-3">
        <div className="min-w-0">
          <Txt as="h2" variant="subheading" tone="ink" className="truncate">
            {nodeQuery.data?.node.name ?? nodeName}
          </Txt>
          <div className="mt-1 flex h-6 items-center gap-2">
            {nodeQuery.data ? (
              <>
                <Badge variant="neutral" emphasis="subtle">
                  {nodeQuery.data.node.kind}
                </Badge>
                <RungBadge rung={nodeQuery.data.node.rung} />
              </>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" className="ml-auto" onClick={onClose}>
          <X />
        </Button>
      </header>
      <KnowledgeFlyoutBody
        query={nodeQuery}
        focusRecordId={focusRecordId}
        onSelectRecord={onSelectRecord}
        onNodeRef={onNodeRef}
        onOpenThread={onOpenThread}
      />
    </>
  );
}

function KnowledgeFlyoutBody({
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
