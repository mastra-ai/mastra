import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Maximize2, Sparkles, TriangleAlert } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

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
 * The app-wide provider uses a 0ms delay, which suits icon buttons but makes
 * card-sized targets fire while the pointer merely crosses the board. One
 * provider covers every card on the board; a board holds hundreds of them.
 */
export function BoardTooltipDelay({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={400}>{children}</TooltipProvider>;
}

export function CardTitleTooltip({ title, children }: { title: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top" className="max-w-90">
        <span className="wrap-anywhere whitespace-pre-wrap">{title}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Card chrome a hover can reveal: the click affordance and the actions menu.
 * Gated on `pointer-fine` because a touch screen has no hover to reveal it
 * with, and stays up while its menu is open.
 */
export const REVEAL_ON_CARD_HOVER =
  'transition-opacity duration-200 ease-out motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:aria-expanded:opacity-100';

/** Hover hint that a card opens its details instead of acting on it. */
export function CardDetailsHint({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'text-ui-xs text-icon4 ml-auto flex shrink-0 items-center gap-1.5',
        REVEAL_ON_CARD_HOVER,
        className,
      )}
    >
      <Maximize2 size={11} aria-hidden />
      Details
    </span>
  );
}

/** The card's one status row: a live region once something is happening. */
export function CardStatus({
  status,
  onApprove,
  approving,
  onRetry,
  retrying,
}: {
  status: BoardCardStatus;
  /** Releases the parked run; omitted when nothing is waiting. */
  onApprove?: () => void;
  approving?: boolean;
  /** Re-queues the failed rule effect; omitted when nothing is retryable. */
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (status.kind === 'idle') return null;

  // A parked run is the one idle state the card cannot whisper: it needs the
  // user, so it stays lit without a hover and carries its own button. The
  // button sits above the card's click overlay so a card that already links to
  // a session can still release it.
  if (status.kind === 'waiting') {
    return (
      <div className="flex w-full items-center justify-between gap-2">
        <span role="status" aria-live="polite" className="text-ui-xs text-accent6 flex min-w-0 items-center gap-1.5">
          <Sparkles size={11} aria-hidden className="shrink-0" />
          <span className="truncate">Suggested: {status.label}</span>
        </span>
        {onApprove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative z-20 shrink-0"
            disabled={approving}
            aria-label={`Start suggested run: ${status.label}`}
            onClick={onApprove}
          >
            {approving ? 'Starting…' : 'Start'}
          </Button>
        )}
      </div>
    );
  }

  if (status.kind === 'busy') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-ui-xs text-icon4 ml-auto flex shrink-0 items-center gap-1.5"
      >
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
          'focus-visible:outline-accent1 relative cursor-help underline decoration-dotted underline-offset-2 outline-none focus-visible:outline-2',
      )}
    >
      <TriangleAlert size={11} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 wrap-anywhere">{status.label}</span>
    </span>
  );

  return (
    // Failure text plus its Retry never share a line with anything else.
    <div className="flex w-full items-start justify-between gap-2">
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
        <Button type="button" variant="outline" size="sm" className="relative" disabled={retrying} onClick={onRetry}>
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
          className="border-border1 text-ui-xs text-icon4 inline-flex h-5 max-w-full items-center gap-1 rounded-full border px-1.5"
          title={label}
        >
          <span className={cn('size-1 shrink-0 rounded-full', labelDotClass(label))} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="border-border1 text-ui-xs text-icon3 inline-flex h-5 items-center rounded-full border px-1.5">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
