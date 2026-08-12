import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquare, Play, TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import type { BoardCardStatus } from '../boardCardStatus';
import { HIDDEN_CARD_LABELS, SOURCE_LABELS } from '../boardItems';
import type { WorkItemSource } from '../services/workItems';

export function SourceTitle({ source, title }: { source: WorkItemSource; title: string }) {
  return (
    <>
      <span className="sr-only">{SOURCE_LABELS[source]}: </span>
      <span>{title}</span>
    </>
  );
}

/**
 * Card titles are clipped to one line, so the full text is only reachable on
 * hover. The tooltip anchors to the whole card rather than the title span: in
 * `WorkItemCard` the click target is an `absolute inset-0 z-10` overlay that
 * paints over the title, so a trigger on the title itself would never see a
 * pointer event.
 */
export function CardTitleTooltip({ title, children }: { title: string; children: ReactElement }) {
  return (
    // The app-wide provider uses a 0ms delay, which is fine for icon buttons but
    // makes a card-sized target fire while the pointer merely crosses the board.
    <TooltipProvider delay={400}>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side="top" className="max-w-90">
          <span className="wrap-anywhere whitespace-pre-wrap">{title}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The card's one status row: a hover hint when idle, a live region once something is happening. */
export function CardStatus({
  status,
  onRetry,
  retrying,
}: {
  status: BoardCardStatus;
  /** Re-queues the failed rule effect; omitted when nothing is retryable. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (status.kind === 'idle') {
    const Icon = status.affordance === 'open' ? MessageSquare : Play;
    return (
      <span
        aria-hidden
        className="text-ui-xs text-icon3 group-hover:text-icon5 group-focus-within:text-icon5 flex items-center gap-1.5 transition-colors motion-reduce:transition-none"
      >
        <Icon size={11} aria-hidden />
        {status.label}
      </span>
    );
  }

  if (status.kind === 'busy') {
    return (
      <span role="status" aria-live="polite" className="text-ui-xs text-icon4 flex items-center gap-1.5">
        <Spinner size="sm" aria-hidden className="size-3" />
        {status.label}
      </span>
    );
  }

  const message = (
    <span
      role="alert"
      tabIndex={status.detail === undefined ? undefined : 0}
      className={cn(
        'text-ui-xs text-error flex min-w-0 items-start gap-1.5',
        status.detail !== undefined &&
          'focus-visible:outline-accent1 relative z-20 cursor-help underline decoration-dotted underline-offset-2 outline-none focus-visible:outline-2',
      )}
    >
      <TriangleAlert size={11} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 wrap-anywhere">{status.label}</span>
    </span>
  );

  return (
    <div className="flex items-start justify-between gap-2">
      {status.detail === undefined ? (
        message
      ) : (
        // Raw failure text stays one hover away instead of costing a row.
        <Tooltip>
          <TooltipTrigger render={message} />
          <TooltipContent side="top" className="max-w-80">
            <span className="wrap-anywhere whitespace-pre-wrap">{status.detail}</span>
          </TooltipContent>
        </Tooltip>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative z-20"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </div>
  );
}

function labelDotClass(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bug') || normalized.includes('error')) return 'bg-accent2';
  if (normalized.includes('approval') || normalized.includes('priority')) return 'bg-accent6';
  if (normalized.includes('triage') || normalized.includes('ready')) return 'bg-accent1';
  if (normalized.includes('cli') || normalized.includes('linear')) return 'bg-accent3';
  if (normalized.includes('work') || normalized.includes('trio')) return 'bg-accent6';
  return 'bg-icon3';
}

export function CardLabels({ labels }: { labels: readonly string[] }) {
  const displayLabels = labels.filter(label => !HIDDEN_CARD_LABELS.has(label.toLowerCase()));
  if (displayLabels.length === 0) return null;
  const visibleLabels = displayLabels.slice(0, 3);
  const hiddenCount = displayLabels.length - visibleLabels.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Labels">
      {visibleLabels.map(label => (
        <span
          key={label}
          className="border-border1 text-ui-xs text-icon4 inline-flex h-6 max-w-full items-center gap-1 rounded-full border px-2"
          title={label}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', labelDotClass(label))} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="border-border1 text-ui-xs text-icon3 inline-flex h-6 items-center rounded-full border px-2">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
