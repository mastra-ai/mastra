import { Txt } from '@mastra/playground-ui/components/Txt';
import { Button } from '@mastra/playground-ui/components/Button';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { X } from 'lucide-react';
import { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import { KnowledgeRungBadge as RungBadge } from './KnowledgeRungBadge';
import { KnowledgeFlyoutBody } from './KnowledgeFlyoutBody';

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
