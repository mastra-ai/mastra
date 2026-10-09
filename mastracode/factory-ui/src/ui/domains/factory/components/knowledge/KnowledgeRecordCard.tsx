import { cn } from '@mastra/playground-ui/utils/cn';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Pin, ExternalLink, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KnowledgeNodeRecord } from '../../services/knowledge';
import { getRecordBorderClass } from './knowledgeStyles';
import { KnowledgeRungBadge as RungBadge } from './KnowledgeRungBadge';
import { KnowledgeRecordText as RecordText } from './KnowledgeRecordText';
function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function KnowledgeRecordCard({
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
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cardRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  }, [expanded]);
  const reason = typeof record.metadata?.reason === 'string' ? record.metadata.reason : undefined;
  const otherMetadata = Object.entries(record.metadata ?? {}).filter(([key]) => key !== 'reason');
  return (
    <div
      ref={cardRef}
      data-testid="knowledge-record"
      data-pinned={record.pinned || undefined}
      className={cn(
        'rounded-lg border transition-colors duration-fast motion-reduce:transition-none',
        // A10: pinned knowledge records stand out — the same amber accent the graph
        // uses, with a faint amber wash behind the card.
        record.pinned ? 'bg-badge-amber-subtle' : 'bg-card',
        getRecordBorderClass(record.pinned, expanded),
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="w-full px-3 py-2.5 text-left"
        onClick={onToggle}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
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
            <dt className={textStyle({ variant: 'body-sm' })}>Captured in session</dt>
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
            <dt className={textStyle({ variant: 'body-sm' })}>Captured at</dt>
            <dd className={textStyle({ variant: 'body-sm' })}>{new Date(record.capturedAt).toLocaleString()}</dd>
            {record.when ? (
              <>
                <dt className={textStyle({ variant: 'body-sm' })}>When</dt>
                <dd className={textStyle({ variant: 'body-sm' })}>{record.when}</dd>
              </>
            ) : null}
            <dt className={textStyle({ variant: 'body-sm' })}>Scope chain</dt>
            <dd className={cn(textStyle({ variant: 'body-sm' }), 'break-all')}>{record.scope.join(' → ')}</dd>
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
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {otherMetadata.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className={textStyle({ variant: 'meta', tone: 'muted' })}>{key}</dt>
                  <dd className={cn(textStyle({ variant: 'meta', tone: 'muted' }), 'break-all')}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
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
