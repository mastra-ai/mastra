/**
 * The right-side flyout: all the juicy details for a clicked node, organized
 * as collapsible sections — Knowledge node (identity + counts), Knowledge records (the node's
 * records with clickable [[wikilinks]]), and a per-record drill-in with
 * filtered provenance and capture reasoning.
 */

import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, Pin, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeNodeRecord, KnowledgeRung } from '../../services/knowledge';
import { RequestError } from '../../services/request';
import { knowledgeScopes } from './knowledgeScope';
import { parseRecordSegments } from './recordText';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <CollapsibleTrigger className="group border-border flex w-full items-center gap-2 border-t px-4 py-3 text-left">
      <Txt as="span" variant="subheading" tone="ink">
        {title}
      </Txt>
      {count !== undefined ? (
        <Txt as="span" variant="meta" tone="muted" className="bg-fill rounded-full px-1.5 py-0.5">
          {count}
        </Txt>
      ) : null}
      <ChevronDown
        size={14}
        className="text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
      />
    </CollapsibleTrigger>
  );
}

function RungBadge({ rung }: { rung: KnowledgeRung }) {
  return (
    <Badge variant={knowledgeScopes[rung].tone} emphasis="subtle">
      {RUNG_LABELS[rung].toLowerCase()}
    </Badge>
  );
}

function RecordText({ text, onNodeRef }: { text: string; onNodeRef?: (name: string) => void }) {
  return (
    <span>
      {parseRecordSegments(text).map((segment, index) =>
        segment.type === 'wikilink' ? (
          <button
            key={index}
            type="button"
            className="bg-badge-purple-subtle text-badge-purple-foreground hover:bg-badge-purple-strong rounded px-1"
            onClick={event => {
              event.stopPropagation();
              onNodeRef?.(segment.value);
            }}
          >
            <Txt as="span" variant="label" className="block">
              {segment.value}
            </Txt>
          </button>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </span>
  );
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function RecordCard({
  record,
  expanded,
  onToggle,
  onNodeRef,
}: {
  record: KnowledgeNodeRecord;
  /**
   * Selection is bidirectional and single: the page owns the selected record,
   * so a graph edge/marker click expands exactly this card, and expanding a
   * card selects (lights up) its knowledge record in the graph while collapsing the
   * others.
   */
  expanded: boolean;
  onToggle: () => void;
  onNodeRef?: (name: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) {
      // Bring the selected knowledge record into view — a clicked edge or marker may
      // back a knowledge record deep down the list.
      cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  }, [expanded]);
  const reason = record.reason;
  return (
    <div
      ref={cardRef}
      data-testid="knowledge-record"
      data-pinned={record.pinned || undefined}
      className={cn(
        'duration-fast rounded-lg border transition-colors motion-reduce:transition-none',
        // A10: pinned knowledge records stand out — the same amber accent the graph
        // uses, with a faint amber wash behind the card.
        record.pinned ? 'bg-badge-amber-subtle' : 'bg-card',
        expanded
          ? record.pinned
            ? 'border-badge-amber-indicator'
            : 'border-badge-blue-edge'
          : record.pinned
            ? 'border-badge-amber-edge'
            : 'border-border',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full px-3 py-2.5 text-left"
        onClick={onToggle}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="text-foreground">
          <RecordText text={record.text} onNodeRef={onNodeRef} />
          {record.pinned ? (
            <Pin size={11} className="text-badge-amber-indicator ml-1 inline" aria-label="Pinned knowledge record" />
          ) : null}
        </div>
        <div className="text-muted-foreground mt-1.5 flex items-center gap-2">
          {record.relation === 'mentions' ? (
            <Txt as="span" variant="meta" tone="muted">
              mentions
            </Txt>
          ) : null}
          <Txt as="span" variant="meta">
            created {relativeTime(record.createdAt)}
          </Txt>
        </div>
      </div>
      {expanded ? (
        <div data-testid="knowledge-record-detail" className="border-border border-t px-3 py-2.5">
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
            <dt className={textStyle({ variant: 'body-sm' })}>Created at</dt>
            <dd className={textStyle({ variant: 'body-sm' })}>{new Date(record.createdAt).toLocaleString()}</dd>
            {record.when ? (
              <>
                <dt className={textStyle({ variant: 'body-sm' })}>When</dt>
                <dd className={textStyle({ variant: 'body-sm' })}>{record.when}</dd>
              </>
            ) : null}
            <dt className={textStyle({ variant: 'body-sm' })}>Pinned</dt>
            <dd className={textStyle({ variant: 'body-sm' })}>{record.pinned ? 'yes' : 'no'}</dd>
          </dl>
          {reason ? (
            <div
              data-testid="knowledge-record-reason"
              className="border-badge-amber-edge bg-badge-amber-subtle mt-2 rounded-md border p-2"
            >
              <div className="text-badge-amber-foreground mb-1 flex items-center gap-1 uppercase">
                <Sparkles size={10} />
                <Txt as="span" variant="meta" className="block">
                  Reasoning
                </Txt>
              </div>
              <Txt as="p" variant="body-sm" tone="ink" className="italic">
                {reason}
              </Txt>
            </div>
          ) : (
            <Txt as="p" variant="meta" tone="muted" className="mt-2 italic">
              No capture reasoning was recorded for this knowledge record.
            </Txt>
          )}
        </div>
      ) : null}
    </div>
  );
}

export interface KnowledgeFlyoutProps {
  factoryProjectId: string;
  nodeId: string;
  scopeId: string;
  threadId?: string;
  /** Highlight the knowledge record backing a clicked edge. */
  focusRecordId?: string;
  /** Card expand/collapse selects (or clears) the knowledge record page-wide — the graph lights it up too. */
  onSelectRecord?: (recordId: string | null) => void;
  onClose: () => void;
  onNodeRef?: (name: string) => void;
}

export function KnowledgeFlyout({
  factoryProjectId,
  nodeId,
  scopeId,
  threadId,
  focusRecordId,
  onSelectRecord,
  onClose,
  onNodeRef,
}: KnowledgeFlyoutProps) {
  const nodeQuery = useKnowledgeNode(factoryProjectId, nodeId, scopeId, threadId);

  return (
    <aside
      data-testid="knowledge-flyout"
      className="border-border bg-card shadow-overlay duration-normal fixed inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col overflow-hidden rounded-t-xl border-t transition-transform motion-reduce:transition-none md:static md:z-auto md:max-h-none md:w-[380px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none"
      aria-label="Knowledge node details"
    >
      {nodeQuery.isPending ? (
        <Txt as="p" variant="body" tone="muted" className="p-4">
          Loading knowledge node…
        </Txt>
      ) : nodeQuery.isError && nodeQuery.error instanceof RequestError && nodeQuery.error.status === 404 ? (
        <div className="flex items-start justify-between gap-2 p-4">
          <Txt as="p" variant="body" tone="muted">
            This knowledge node is no longer available.
          </Txt>
          <Button variant="ghost" size="icon-sm" aria-label="Close node details" onClick={onClose}>
            <X />
          </Button>
        </div>
      ) : nodeQuery.isError ? (
        <div className="p-4">
          <Notice variant="destructive">Unable to load this knowledge node.</Notice>
        </div>
      ) : (
        <>
          <header className="flex items-start gap-2 px-4 py-3">
            <div className="min-w-0">
              <Txt as="h2" variant="subheading" tone="ink" className="truncate">
                {nodeQuery.data.node.name}
              </Txt>
              <div className="mt-1 flex items-center gap-2">
                <Txt as="span" variant="meta" tone="muted" className="bg-fill rounded px-1.5 py-0.5">
                  {nodeQuery.data.node.kind}
                </Txt>
                <RungBadge rung={nodeQuery.data.node.rung} />
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close details" className="ml-auto" onClick={onClose}>
              <X />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {nodeQuery.data.node.description?.trim() ? (
              <Collapsible defaultOpen>
                <SectionHeader title="Description" />
                <CollapsibleContent>
                  <Txt as="p" variant="caption" tone="ink" className="px-4 pb-3 break-words whitespace-pre-wrap">
                    <RecordText text={nodeQuery.data.node.description} onNodeRef={onNodeRef} />
                  </Txt>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <Collapsible defaultOpen>
              <SectionHeader title="Knowledge node" />
              <CollapsibleContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3">
                  <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Kind</dt>
                  <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
                    {nodeQuery.data.node.kind}
                  </dd>
                  <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Created</dt>
                  <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
                    {new Date(nodeQuery.data.node.createdAt).toLocaleString()}
                  </dd>
                  <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Updated</dt>
                  <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
                    {new Date(nodeQuery.data.node.updatedAt).toLocaleString()}
                  </dd>
                  <dt className={textStyle({ variant: 'caption', tone: 'muted' })}>Knowledge records</dt>
                  <dd className={cn(textStyle({ tone: 'ink', variant: 'caption' }), 'text-right')}>
                    {nodeQuery.data.records.length}
                  </dd>
                </dl>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <SectionHeader title="Knowledge records" count={nodeQuery.data.records.length} />
              <CollapsibleContent>
                <div className="flex flex-col gap-2 px-4 pb-3">
                  {nodeQuery.data.records.length === 0 ? (
                    <Txt as="p" variant="caption" tone="muted">
                      No knowledge records about this node yet.
                    </Txt>
                  ) : (
                    nodeQuery.data.records.map(record => (
                      <div
                        key={record.id}
                        className={
                          record.id === focusRecordId
                            ? cn(
                                'rounded-lg ring-2',
                                record.pinned ? 'ring-badge-amber-indicator' : 'ring-badge-blue-indicator',
                              )
                            : undefined
                        }
                      >
                        <RecordCard
                          record={record}
                          expanded={record.id === focusRecordId}
                          onToggle={() => onSelectRecord?.(record.id === focusRecordId ? null : record.id)}
                          onNodeRef={onNodeRef}
                        />
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </>
      )}
    </aside>
  );
}
