/**
 * The right-side flyout: all the juicy details for a clicked node, organized
 * as collapsible sections — Knowledge node (identity + counts), Knowledge items (the node's
 * items with clickable [[wikilinks]]), and a per-knowledge item drill-in with full
 * provenance including the capture agent's reasoning (`metadata.reason`) and
 * the "captured in session" link that opens the thread view (Amendment A2).
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ChevronDown, ExternalLink, Pin, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useKnowledgeNode } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeNodeItem, KnowledgeRung } from '../../services/knowledge';
import { parseItemSegments } from './itemText';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <CollapsibleTrigger className="group border-surface5 flex w-full items-center gap-2 border-t px-4 py-3 text-left">
      <span className="text-icon6 text-sm font-semibold">{title}</span>
      {count !== undefined ? (
        <span className="bg-surface4 text-icon4 rounded-full px-1.5 py-0.5 text-[10px]">{count}</span>
      ) : null}
      <ChevronDown size={14} className="text-icon3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}

function RungBadge({ rung }: { rung: KnowledgeRung }) {
  return (
    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
      {RUNG_LABELS[rung].toLowerCase()}
    </span>
  );
}

function ItemText({ text, onNodeRef }: { text: string; onNodeRef?: (name: string) => void }) {
  return (
    <span>
      {parseItemSegments(text).map((segment, index) =>
        segment.type === 'wikilink' ? (
          <button
            key={index}
            type="button"
            className="rounded bg-purple-500/15 px-1 font-medium text-purple-300 hover:bg-purple-500/30"
            onClick={event => {
              event.stopPropagation();
              onNodeRef?.(segment.value);
            }}
          >
            {segment.value}
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

function ItemCard({
  item,
  expanded,
  onToggle,
  onNodeRef,
  onOpenThread,
}: {
  item: KnowledgeNodeItem;
  /**
   * Selection is bidirectional and single: the page owns the selected item,
   * so a graph edge/marker click expands exactly this card, and expanding a
   * card selects (lights up) its knowledge item in the graph while collapsing the
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
      // Bring the selected knowledge item into view — a clicked edge or marker may
      // back a knowledge item deep down the list.
      cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  }, [expanded]);
  const reason = typeof item.metadata?.reason === 'string' ? item.metadata.reason : undefined;
  const otherMetadata = Object.entries(item.metadata ?? {}).filter(([key]) => key !== 'reason');
  return (
    <div
      ref={cardRef}
      data-testid="knowledge-item"
      data-pinned={item.pinned || undefined}
      className={[
        'rounded-lg border transition-colors',
        // A10: pinned knowledge items stand out — the same amber accent the graph
        // uses, with a faint amber wash behind the card.
        item.pinned ? 'bg-amber-400/10' : 'bg-surface3/60',
        expanded
          ? item.pinned
            ? 'border-amber-400/70'
            : 'border-purple-400/50'
          : item.pinned
            ? 'border-amber-400/40'
            : 'border-surface5',
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
        <div className="text-icon5 text-xs leading-relaxed">
          <ItemText text={item.text} onNodeRef={onNodeRef} />
          {item.pinned ? <Pin size={11} className="ml-1 inline text-amber-400" aria-label="Pinned knowledge item" /> : null}
        </div>
        <div className="text-icon3 mt-1.5 flex items-center gap-2 text-[10px]">
          <RungBadge rung={item.rung} />
          {item.relation === 'mentions' ? <span className="text-icon3">mentions</span> : null}
          <span>captured {relativeTime(item.capturedAt)}</span>
        </div>
      </div>
      {expanded ? (
        <div data-testid="knowledge-item-detail" className="border-surface5 border-t px-3 py-2.5 text-[11px]">
          <dl className="text-icon4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
            <dt>Captured in session</dt>
            <dd>
              {item.sourceThreadId ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-purple-300 hover:underline"
                  onClick={() => onOpenThread?.(item.sourceThreadId)}
                >
                  <span className="max-w-40 truncate">{item.sourceThreadId}</span>
                  <ExternalLink size={10} />
                </button>
              ) : (
                '—'
              )}
            </dd>
            <dt>Captured at</dt>
            <dd>{new Date(item.capturedAt).toLocaleString()}</dd>
            {item.when ? (
              <>
                <dt>When</dt>
                <dd>{item.when}</dd>
              </>
            ) : null}
            <dt>Scope chain</dt>
            <dd className="break-all">{item.scope.join(' → ')}</dd>
            <dt>Pinned</dt>
            <dd>{item.pinned ? 'yes' : 'no'}</dd>
          </dl>
          {reason ? (
            <div
              data-testid="knowledge-item-reason"
              className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-2"
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                <Sparkles size={10} /> Reasoning
              </div>
              <p className="text-icon5 text-[11px] leading-relaxed italic">{reason}</p>
            </div>
          ) : (
            <p className="text-icon3 mt-2 text-[10px] italic">No capture reasoning was recorded for this knowledge item.</p>
          )}
          {otherMetadata.length > 0 ? (
            <dl className="text-icon3 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
              {otherMetadata.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt>{key}</dt>
                  <dd className="break-all">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
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
  /** Highlight the knowledge item backing a clicked edge. */
  focusItemId?: string;
  /** Card expand/collapse selects (or clears) the knowledge item page-wide — the graph lights it up too. */
  onSelectItem?: (itemId: string | null) => void;
  onClose: () => void;
  onNodeRef?: (name: string) => void;
  onOpenThread?: (threadId: string) => void;
}

export function KnowledgeFlyout({
  factoryProjectId,
  nodeId,
  threadId,
  focusItemId,
  onSelectItem,
  onClose,
  onNodeRef,
  onOpenThread,
}: KnowledgeFlyoutProps) {
  const nodeQuery = useKnowledgeNode(factoryProjectId, nodeId, threadId);

  return (
    <aside
      data-testid="knowledge-flyout"
      className="border-surface5 bg-surface2/95 absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col overflow-hidden rounded-l-xl border-l shadow-2xl backdrop-blur transition-transform duration-300"
      aria-label="Knowledge node details"
    >
      {nodeQuery.isPending ? (
        <div className="text-icon3 p-4 text-sm">Loading knowledge node…</div>
      ) : nodeQuery.isError ? (
        <div className="p-4">
          <Notice variant="destructive">Unable to load this knowledge node.</Notice>
        </div>
      ) : (
        <>
          <header className="flex items-start gap-2 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-icon6 truncate text-base font-semibold">{nodeQuery.data.node.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-surface4 text-icon4 rounded px-1.5 py-0.5 text-[10px]">
                  {nodeQuery.data.node.kind}
                </span>
                <RungBadge rung={nodeQuery.data.node.rung} />
              </div>
            </div>
            <button
              type="button"
              aria-label="Close details"
              className="text-icon3 hover:text-icon6 ml-auto rounded p-1"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <Collapsible defaultOpen>
              <SectionHeader title="Knowledge node" />
              <CollapsibleContent>
                <dl className="text-icon4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3 text-xs">
                  <dt>Kind</dt>
                  <dd className="text-icon5 text-right">{nodeQuery.data.node.kind}</dd>
                  <dt>Scope</dt>
                  <dd className="text-icon5 text-right break-all">{nodeQuery.data.node.scope.join(' → ')}</dd>
                  <dt>Created</dt>
                  <dd className="text-icon5 text-right">
                    {new Date(nodeQuery.data.node.createdAt).toLocaleString()}
                  </dd>
                  <dt>Updated</dt>
                  <dd className="text-icon5 text-right">
                    {new Date(nodeQuery.data.node.updatedAt).toLocaleString()}
                  </dd>
                  <dt>Knowledge items</dt>
                  <dd className="text-icon5 text-right">{nodeQuery.data.items.length}</dd>
                </dl>
              </CollapsibleContent>
            </Collapsible>

            {nodeQuery.data.node.content ? (
              <Collapsible defaultOpen>
                <SectionHeader title="Content" />
                <CollapsibleContent>
                  <p className="text-icon5 whitespace-pre-wrap px-4 pb-3 text-xs leading-relaxed">
                    <ItemText text={nodeQuery.data.node.content} onNodeRef={onNodeRef} />
                  </p>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            <Collapsible defaultOpen>
              <SectionHeader title="Knowledge items" count={nodeQuery.data.items.length} />
              <CollapsibleContent>
                <div className="flex flex-col gap-2 px-4 pb-3">
                  {nodeQuery.data.items.length === 0 ? (
                    <p className="text-icon3 text-xs">No knowledge items about this node yet.</p>
                  ) : (
                    nodeQuery.data.items.map(item => (
                      <div
                        key={item.id}
                        className={item.id === focusItemId ? 'rounded-lg ring-2 ring-purple-400/60' : undefined}
                      >
                        <ItemCard
                          item={item}
                          expanded={item.id === focusItemId}
                          onToggle={() => onSelectItem?.(item.id === focusItemId ? null : item.id)}
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
