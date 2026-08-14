/**
 * The right-side flyout: all the juicy details for a clicked entity, organized
 * as collapsible sections — Entity (identity + counts), Memories (the entity's
 * facts with clickable [[wikilinks]]), and a per-memory drill-in with full
 * provenance including the capture agent's reasoning (`metadata.reason`) and
 * the "captured in session" link that opens the thread view (Amendment A2).
 */

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@mastra/playground-ui/components/Collapsible';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ChevronDown, ExternalLink, Pin, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useKnowledgeEntity } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeEntityFact, KnowledgeRung } from '../../services/knowledge';
import { parseFactSegments } from './factText';

const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'Org', resource: 'Project', thread: 'Session' };

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <CollapsibleTrigger className="group flex w-full items-center gap-2 border-t border-surface5 px-4 py-3 text-left">
      <span className="text-sm font-semibold text-icon6">{title}</span>
      {count !== undefined ? (
        <span className="rounded-full bg-surface4 px-1.5 py-0.5 text-[10px] text-icon4">{count}</span>
      ) : null}
      <ChevronDown size={14} className="ml-auto text-icon3 transition-transform group-data-[state=open]:rotate-180" />
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

function FactText({ text, onEntityRef }: { text: string; onEntityRef?: (name: string) => void }) {
  return (
    <span>
      {parseFactSegments(text).map((segment, index) =>
        segment.type === 'wikilink' ? (
          <button
            key={index}
            type="button"
            className="rounded bg-purple-500/15 px-1 font-medium text-purple-300 hover:bg-purple-500/30"
            onClick={event => {
              event.stopPropagation();
              onEntityRef?.(segment.value);
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

function MemoryCard({
  fact,
  focused,
  onEntityRef,
  onOpenThread,
}: {
  fact: KnowledgeEntityFact;
  /** An edge click SELECTS the supporting memory: expand it, not just ring it (A7). */
  focused?: boolean;
  onEntityRef?: (name: string) => void;
  onOpenThread?: (threadId: string) => void;
}) {
  const [expanded, setExpanded] = useState(focused ?? false);
  useEffect(() => {
    if (focused) setExpanded(true);
  }, [focused]);
  const reason = typeof fact.metadata?.reason === 'string' ? fact.metadata.reason : undefined;
  const otherMetadata = Object.entries(fact.metadata ?? {}).filter(([key]) => key !== 'reason');
  return (
    <div
      data-testid="knowledge-memory"
      data-pinned={fact.pinned || undefined}
      className={[
        'rounded-lg border transition-colors',
        // A10: pinned memories stand out — the same amber accent the graph
        // uses, with a faint amber wash behind the card.
        fact.pinned ? 'bg-amber-400/10' : 'bg-surface3/60',
        expanded
          ? fact.pinned
            ? 'border-amber-400/70'
            : 'border-purple-400/50'
          : fact.pinned
            ? 'border-amber-400/40'
            : 'border-surface5',
      ].join(' ')}
    >
      <button type="button" className="w-full px-3 py-2.5 text-left" onClick={() => setExpanded(open => !open)}>
        <div className="text-xs leading-relaxed text-icon5">
          <FactText text={fact.text} onEntityRef={onEntityRef} />
          {fact.pinned ? (
            <Pin size={11} className="ml-1 inline text-amber-400" aria-label="Pinned memory" />
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-icon3">
          <RungBadge rung={fact.rung} />
          {fact.relation === 'mentions' ? <span className="text-icon3">mentions</span> : null}
          <span>captured {relativeTime(fact.capturedAt)}</span>
        </div>
      </button>
      {expanded ? (
        <div data-testid="knowledge-memory-detail" className="border-t border-surface5 px-3 py-2.5 text-[11px]">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-icon4">
            <dt>Captured in session</dt>
            <dd>
              {fact.sourceThreadId ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-purple-300 hover:underline"
                  onClick={() => onOpenThread?.(fact.sourceThreadId)}
                >
                  <span className="max-w-40 truncate">{fact.sourceThreadId}</span>
                  <ExternalLink size={10} />
                </button>
              ) : (
                '—'
              )}
            </dd>
            <dt>Captured at</dt>
            <dd>{new Date(fact.capturedAt).toLocaleString()}</dd>
            {fact.when ? (
              <>
                <dt>When</dt>
                <dd>{fact.when}</dd>
              </>
            ) : null}
            <dt>Scope chain</dt>
            <dd className="break-all">{fact.scope.join(' → ')}</dd>
            <dt>Pinned</dt>
            <dd>{fact.pinned ? 'yes' : 'no'}</dd>
          </dl>
          {reason ? (
            <div
              data-testid="knowledge-memory-reason"
              className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-2"
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                <Sparkles size={10} /> Reasoning
              </div>
              <p className="text-[11px] leading-relaxed text-icon5 italic">{reason}</p>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-icon3 italic">No capture reasoning was recorded for this memory.</p>
          )}
          {otherMetadata.length > 0 ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] text-icon3">
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
  entityId: string;
  threadId?: string;
  /** Highlight the memory backing a clicked edge. */
  focusFactId?: string;
  onClose: () => void;
  onEntityRef?: (name: string) => void;
  onOpenThread?: (threadId: string) => void;
}

export function KnowledgeFlyout({
  factoryProjectId,
  entityId,
  threadId,
  focusFactId,
  onClose,
  onEntityRef,
  onOpenThread,
}: KnowledgeFlyoutProps) {
  const entityQuery = useKnowledgeEntity(factoryProjectId, entityId, threadId);

  return (
    <aside
      data-testid="knowledge-flyout"
      className="absolute inset-y-0 right-0 z-20 flex w-[380px] flex-col overflow-hidden rounded-l-xl border-l border-surface5 bg-surface2/95 shadow-2xl backdrop-blur transition-transform duration-300"
      aria-label="Entity details"
    >
      {entityQuery.isPending ? (
        <div className="p-4 text-sm text-icon3">Loading entity…</div>
      ) : entityQuery.isError ? (
        <div className="p-4">
          <Notice variant="destructive">Unable to load this entity.</Notice>
        </div>
      ) : (
        <>
          <header className="flex items-start gap-2 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-icon6">{entityQuery.data.entity.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-surface4 px-1.5 py-0.5 text-[10px] text-icon4">
                  {entityQuery.data.entity.kind}
                </span>
                <RungBadge rung={entityQuery.data.entity.rung} />
              </div>
            </div>
            <button
              type="button"
              aria-label="Close details"
              className="ml-auto rounded p-1 text-icon3 hover:text-icon6"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <Collapsible defaultOpen>
              <SectionHeader title="Entity" />
              <CollapsibleContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3 text-xs text-icon4">
                  <dt>Kind</dt>
                  <dd className="text-right text-icon5">{entityQuery.data.entity.kind}</dd>
                  <dt>Scope</dt>
                  <dd className="text-right break-all text-icon5">{entityQuery.data.entity.scope.join(' → ')}</dd>
                  <dt>Created</dt>
                  <dd className="text-right text-icon5">
                    {new Date(entityQuery.data.entity.createdAt).toLocaleString()}
                  </dd>
                  <dt>Updated</dt>
                  <dd className="text-right text-icon5">
                    {new Date(entityQuery.data.entity.updatedAt).toLocaleString()}
                  </dd>
                  <dt>Memories</dt>
                  <dd className="text-right text-icon5">{entityQuery.data.facts.length}</dd>
                </dl>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <SectionHeader title="Memories" count={entityQuery.data.facts.length} />
              <CollapsibleContent>
                <div className="flex flex-col gap-2 px-4 pb-3">
                  {entityQuery.data.facts.length === 0 ? (
                    <p className="text-xs text-icon3">No memories about this entity yet.</p>
                  ) : (
                    entityQuery.data.facts.map(fact => (
                      <div
                        key={fact.id}
                        className={fact.id === focusFactId ? 'rounded-lg ring-2 ring-purple-400/60' : undefined}
                      >
                        <MemoryCard
                          fact={fact}
                          focused={fact.id === focusFactId}
                          onEntityRef={onEntityRef}
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
