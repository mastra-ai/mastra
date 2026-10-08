import { cn } from '@mastra/playground-ui/utils/cn';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import type { KnowledgeNodePayload } from '../../services/knowledge';
import { getRecordRingClass } from './knowledgeStyles';
import type { KnowledgeFlyoutProps } from './KnowledgeFlyout';
import { KnowledgeSectionHeader as SectionHeader } from './KnowledgeSectionHeader';
import { KnowledgeRecordText as RecordText } from './KnowledgeRecordText';
import { KnowledgeRecordCard as RecordCard } from './KnowledgeRecordCard';
export function KnowledgeNodeDetails({
  details,
  focusRecordId,
  onSelectRecord,
  onNodeRef,
  onOpenThread,
}: { details: KnowledgeNodePayload } & Pick<
  KnowledgeFlyoutProps,
  'focusRecordId' | 'onSelectRecord' | 'onNodeRef' | 'onOpenThread'
>) {
  return (
    <div className="knowledge-details-content min-h-0 flex-1 overflow-y-auto pb-4">
      {details.node.content.trim() ? (
        <Collapsible defaultOpen>
          <SectionHeader title="Content" />
          <CollapsibleContent>
            <Txt as="p" variant="caption" tone="ink" className="px-4 pb-3 break-words whitespace-pre-wrap">
              <RecordText text={details.node.content} onNodeRef={onNodeRef} />
            </Txt>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Collapsible defaultOpen>
        <SectionHeader title="Knowledge node" />
        <CollapsibleContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3">
            <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Kind</dt>
            <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>{details.node.kind}</dd>
            <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Scope</dt>
            <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right break-all')}>
              {details.node.scope.join(' → ')}
            </dd>
            <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Created</dt>
            <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
              {new Date(details.node.createdAt).toLocaleString()}
            </dd>
            <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Updated</dt>
            <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
              {new Date(details.node.updatedAt).toLocaleString()}
            </dd>
            <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Knowledge records</dt>
            <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
              {details.records.length}
            </dd>
          </dl>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <SectionHeader title="Knowledge records" count={details.records.length} />
        <CollapsibleContent>
          <div className="flex flex-col gap-2 px-4 pb-3">
            {details.records.length === 0 ? (
              <Txt as="p" variant="caption" tone="muted">
                No knowledge records about this node yet.
              </Txt>
            ) : (
              details.records.map(record => (
                <div
                  key={record.id}
                  className={
                    record.id === focusRecordId ? cn('rounded-lg', getRecordRingClass(record.pinned)) : undefined
                  }
                >
                  <RecordCard
                    record={record}
                    expanded={record.id === focusRecordId}
                    onToggle={() => onSelectRecord?.(record.id === focusRecordId ? null : record.id)}
                    onNodeRef={onNodeRef}
                    onOpenThread={onOpenThread}
                  />
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
