import { Txt } from '@mastra/playground-ui/components/Txt';
/**
 * The right-side flyout: all the juicy details for a clicked node, organized
 * as collapsible sections — Knowledge node (identity + counts), Knowledge records (the node's
 * records with clickable [[wikilinks]]), and a per-knowledge record drill-in with full
 * provenance including the capture agent's reasoning (`metadata.reason`) and
 * the "captured in session" link that opens the thread view (Amendment A2).
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ChevronDown, ExternalLink, Pin, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeNodeRecord, KnowledgeRung } from '../../services/knowledge';
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
        className="text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
  );
}

function RungBadge({ rung }: { rung: KnowledgeRung }) {
  return (
    <Txt as="span" variant="meta" className="bg-badge-purple-strong text-badge-purple-foreground rounded px-1.5 py-0.5">
      {RUNG_LABELS[rung].toLowerCase()}
    </Txt>
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
  onOpenThread,
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
  onOpenThread?: (threadId: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) {
      // Bring the selected knowledge record into view — a clicked edge or marker may
      // back a knowledge record deep down the list.
      cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  }, [expanded]);
  const reason = typeof record.metadata?.reason === 'string' ? record.metadata.reason : undefined;
  const otherMetadata = Object.entries(record.metadata ?? {}).filter(([key]) => key !== 'reason');
  return (
    <div
      ref={cardRef}
      data-testid="knowledge-record"
      data-pinned={record.pinned || undefined}
      className={[
        'rounded-lg border transition-colors',
        // A10: pinned knowledge records stand out — the same amber accent the graph
        // uses, with a faint amber wash behind the card.
        record.pinned ? 'bg-badge-amber-subtle' : 'bg-card',
        expanded
          ? record.pinned
            ? 'border-badge-amber-indicator'
            : 'border-badge-purple-edge'
          : record.pinned
            ? 'border-badge-amber-edge'
            : 'border-border',
      ].join(' ')}
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
          <RungBadge rung={record.rung} />
          {record.relation === 'mentions' ? (
            <Txt as="span" variant="meta" tone="muted">
              mentions
            </Txt>
          ) : null}
          <Txt as="span" variant="meta">
            captured {relativeTime(record.capturedAt)}
          </Txt>
        </div>
      </div>
      {expanded ? (
        <div data-testid="knowledge-record-detail" className="border-border border-t px-3 py-2.5">
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
            <dt>
              <Txt as="span" variant="body-sm" className="block">
                Captured in session
              </Txt>
            </dt>
            <dd>
              {record.sourceThreadId ? (
                <button
                  type="button"
                  className="text-badge-purple-indicator flex items-center gap-1 hover:underline"
                  onClick={() => onOpenThread?.(record.sourceThreadId)}
                >
                  <Txt as="span" variant="body-sm" className="max-w-40 truncate">
                    {record.sourceThreadId}
                  </Txt>
                  <ExternalLink size={10} />
                </button>
              ) : (
                '—'
              )}
            </dd>
            <dt>
              <Txt as="span" variant="body-sm" className="block">
                Captured at
              </Txt>
            </dt>
            <dd>
              <Txt as="span" variant="body-sm" className="block">
                {new Date(record.capturedAt).toLocaleString()}
              </Txt>
            </dd>
            {record.when ? (
              <>
                <dt>
                  <Txt as="span" variant="body-sm" className="block">
                    When
                  </Txt>
                </dt>
                <dd>
                  <Txt as="span" variant="body-sm" className="block">
                    {record.when}
                  </Txt>
                </dd>
              </>
            ) : null}
            <dt>
              <Txt as="span" variant="body-sm" className="block">
                Scope chain
              </Txt>
            </dt>
            <dd className="break-all">
              <Txt as="span" variant="body-sm" className="block">
                {record.scope.join(' → ')}
              </Txt>
            </dd>
            <dt>
              <Txt as="span" variant="body-sm" className="block">
                Pinned
              </Txt>
            </dt>
            <dd>
              <Txt as="span" variant="body-sm" className="block">
                {record.pinned ? 'yes' : 'no'}
              </Txt>
            </dd>
          </dl>
          {reason ? (
            <div
              data-testid="knowledge-record-reason"
              className="border-badge-amber-edge bg-badge-amber-subtle mt-2 rounded-md border p-2"
            >
              <div className="text-badge-amber-foreground mb-1 flex items-center gap-1 uppercase">
                <Sparkles size={10} />
                <Txt as="span" variant="meta" className="block">
                  {' '}
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
          {otherMetadata.length > 0 ? (
            <dl className="text-muted-foreground mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {otherMetadata.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt>
                    <Txt as="span" variant="meta" className="block">
                      {key}
                    </Txt>
                  </dt>
                  <dd className="break-all">
                    <Txt as="span" variant="meta" className="block">
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </Txt>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface KnowledgeFlyoutProps {
  factoryProjectId: string;
  nodeId: string;
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
  threadId,
  focusRecordId,
  onSelectRecord,
  onClose,
  onNodeRef,
  onOpenThread,
}: KnowledgeFlyoutProps) {
  const nodeQuery = useKnowledgeNode(factoryProjectId, nodeId, threadId);

  return (
    <aside
      data-testid="knowledge-flyout"
      className="border-border bg-background shadow-overlay absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col overflow-hidden rounded-l-xl border-l transition-transform duration-300"
      aria-label="Knowledge node details"
    >
      {nodeQuery.isPending ? (
        <div className="text-muted-foreground p-4">
          <Txt as="span" variant="body" className="block">
            Loading knowledge node…
          </Txt>
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
            <button
              type="button"
              aria-label="Close details"
              className="text-muted-foreground hover:text-foreground ml-auto rounded p-1"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {nodeQuery.data.node.content.trim() ? (
              <Collapsible defaultOpen>
                <SectionHeader title="Content" />
                <CollapsibleContent>
                  <Txt as="p" variant="caption" tone="ink" className="px-4 pb-3 break-words whitespace-pre-wrap">
                    <RecordText text={nodeQuery.data.node.content} onNodeRef={onNodeRef} />
                  </Txt>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <Collapsible defaultOpen>
              <SectionHeader title="Knowledge node" />
              <CollapsibleContent>
                <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3">
                  <dt>
                    <Txt as="span" variant="caption" className="block">
                      Kind
                    </Txt>
                  </dt>
                  <dd className="text-foreground text-right">
                    <Txt as="span" variant="caption" className="block">
                      {nodeQuery.data.node.kind}
                    </Txt>
                  </dd>
                  <dt>
                    <Txt as="span" variant="caption" className="block">
                      Scope
                    </Txt>
                  </dt>
                  <dd className="text-foreground text-right break-all">
                    <Txt as="span" variant="caption" className="block">
                      {nodeQuery.data.node.scope.join(' → ')}
                    </Txt>
                  </dd>
                  <dt>
                    <Txt as="span" variant="caption" className="block">
                      Created
                    </Txt>
                  </dt>
                  <dd className="text-foreground text-right">
                    <Txt as="span" variant="caption" className="block">
                      {new Date(nodeQuery.data.node.createdAt).toLocaleString()}
                    </Txt>
                  </dd>
                  <dt>
                    <Txt as="span" variant="caption" className="block">
                      Updated
                    </Txt>
                  </dt>
                  <dd className="text-foreground text-right">
                    <Txt as="span" variant="caption" className="block">
                      {new Date(nodeQuery.data.node.updatedAt).toLocaleString()}
                    </Txt>
                  </dd>
                  <dt>
                    <Txt as="span" variant="caption" className="block">
                      Knowledge records
                    </Txt>
                  </dt>
                  <dd className="text-foreground text-right">
                    <Txt as="span" variant="caption" className="block">
                      {nodeQuery.data.records.length}
                    </Txt>
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
                          record.id === focusRecordId ? 'ring-badge-purple-indicator rounded-lg ring-2' : undefined
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
        </>
      )}
    </aside>
  );
}
