import type { ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { IconHand5Finger } from '@/ds/icons/central/IconHand5Finger';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

export type BoardCardStatus =
  | { kind: 'idle' }
  | { kind: 'waiting'; label: string; decisionId: string }
  /** Triage classed the card as non-bug work, so it waits on a maintainer's call. */
  | { kind: 'held'; label: string }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; label: string; detail?: string; retryDecisionId?: string };

/**
 * Card chrome a hover can reveal: the actions menu. Gated on `pointer-fine`
 * because a touch screen has no hover to reveal it with, and stays up while
 * its menu is open.
 */
export const REVEAL_ON_CARD_HOVER =
  'transition-opacity duration-200 ease-out motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:aria-expanded:opacity-100';

export function SessionBadge() {
  return (
    <Badge size="xs" variant="info" emphasis="subtle" icon={<IconChatBubble7 aria-hidden />} className="shrink-0">
      Session
    </Badge>
  );
}

/** `compact` keeps an error to one truncated line (for list rows) and moves the full text into the tooltip. */
export function CardStatus({ status, compact = false }: { status: BoardCardStatus; compact?: boolean }) {
  // A parked run is surfaced by the highlighted "Start suggested run" action, not a status badge.
  if (status.kind === 'idle' || status.kind === 'waiting') return null;

  if (status.kind === 'held') {
    return (
      <Badge size="xs" variant="orange" icon={<IconHand5Finger aria-hidden />} role="status">
        {status.label}
      </Badge>
    );
  }

  if (status.kind === 'busy') {
    return (
      <Txt
        as="span"
        variant="meta"
        tone="muted"
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5"
      >
        <Spinner size="sm" aria-hidden className="size-3" />
        {status.label}
      </Txt>
    );
  }

  const hasTooltip = compact || status.detail !== undefined;
  const message = (
    <Txt
      as="span"
      variant="meta"
      role="alert"
      tabIndex={hasTooltip ? 0 : undefined}
      className={cn(
        'flex w-full min-w-0 gap-1.5 text-destructive-foreground',
        compact ? 'items-center' : 'items-start',
        hasTooltip && ['relative cursor-help', focusRing],
        status.detail !== undefined && 'underline decoration-dotted underline-offset-2',
      )}
    >
      <IconExclamationTriangle aria-hidden className={cn('size-icon-xs shrink-0', !compact && 'mt-0.5')} />
      <span className={cn('min-w-0', compact ? 'truncate' : 'wrap-anywhere')}>{status.label}</span>
    </Txt>
  );

  if (!hasTooltip) return message;
  // Raw failure text stays one hover away instead of costing a row.
  return (
    <Tooltip>
      <TooltipTrigger render={message} />
      <TooltipContent side="top" className="max-w-80">
        {compact && <span className="block wrap-anywhere">{status.label}</span>}
        {status.detail !== undefined && (
          <span className={cn('block wrap-anywhere whitespace-pre-wrap', compact && 'mt-1 opacity-80')}>
            {status.detail}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function labelDotClass(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bug') || normalized.includes('error')) return 'bg-badge-red-indicator';
  if (normalized.includes('approval') || normalized.includes('priority')) return 'bg-badge-amber-indicator';
  if (normalized.includes('triage') || normalized.includes('ready')) return 'bg-badge-green-indicator';
  if (normalized.includes('cli') || normalized.includes('linear')) return 'bg-badge-blue-indicator';
  if (normalized.includes('work') || normalized.includes('trio')) return 'bg-badge-amber-indicator';
  return 'bg-muted-foreground';
}

/** A card's labels as dots and names; `colors` overrides a label's dot. */
export function MetadataLabels({
  labels,
  colors = {},
  className,
}: {
  labels: readonly string[];
  colors?: Record<string, string>;
  className?: string;
}): ReactNode {
  if (labels.length === 0) return null;
  return (
    <ScrollArea orientation="horizontal" revealScrollbarOnHover={false} aria-label="Labels" className={className}>
      <div className="flex items-center gap-1.5">
        {labels.map(label => (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            key={label}
            className="inline-flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border border-border px-1.5"
            title={label}
          >
            <span
              className={cn('size-1 shrink-0 rounded-full', labelDotClass(label))}
              style={colors[label] ? { backgroundColor: colors[label] } : undefined}
              aria-hidden
            />
            <span className="truncate">{label}</span>
          </Txt>
        ))}
      </div>
    </ScrollArea>
  );
}
