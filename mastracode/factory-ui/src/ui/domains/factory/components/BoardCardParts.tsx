import { cardChangeRequest } from '@mastra/factory/work-items/change-requests';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardState';
import { cardLabels, metadataLabelColors } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import { CARD_SOURCES } from '../cardSources';
import { changeRequestStatus } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { isPullRequestSource } from '../services/workItems';
import type { WorkItem, WorkItemSource } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { IconChatBubble7 } from '@mastra/playground-ui/icons/central/IconChatBubble7';
import { IconHand5Finger } from '@mastra/playground-ui/icons/central/IconHand5Finger';
import './card-actions.css';

export function SourceTitle({ source, title }: { source: WorkItemSource; title: string }) {
  return (
    <>
      <span className="sr-only">{CARD_SOURCES[source].label}: </span>
      {title}
    </>
  );
}

export function WorkItemSourceIcon({
  item,
  subscriptions,
}: {
  item: WorkItem;
  subscriptions?: readonly PullRequestSubscription[];
}) {
  const request = cardChangeRequest(item);
  const pullRequestStatus = request && changeRequestStatus(request, subscriptions);
  if (!request || pullRequestStatus === undefined) return <SourceIcon source={item.source} />;
  const status = <PullRequestStatusIcon status={pullRequestStatus} provider={request.provider} />;
  if (isPullRequestSource(item.source)) return status;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <SourceIcon source={item.source} />
      {status}
    </span>
  );
}

// The app-wide provider fires at 0ms, which makes card-sized targets open as the pointer merely crosses them.
export function BoardTooltipDelay({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={400}>{children}</TooltipProvider>;
}

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
        'text-destructive-foreground flex w-full min-w-0 gap-1.5',
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

export function MetadataLabels({ metadata, className }: { metadata: Record<string, unknown>; className?: string }) {
  const displayLabels = cardLabels(metadata);
  if (displayLabels.length === 0) return null;
  const colors = metadataLabelColors(metadata);
  return (
    <ScrollArea orientation="horizontal" revealScrollbarOnHover={false} aria-label="Labels" className={className}>
      <div className="flex items-center gap-1.5">
        {displayLabels.map(label => (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            key={label}
            className="border-border inline-flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5"
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
export function CardActions({
  actions,
  trailing,
  children,
}: {
  actions: CardAction[];
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  if (actions.length === 0 && !children && !trailing) return null;
  const [main] = actions;
  return (
    <div className="mt-auto flex items-center justify-between gap-2">
      <div className="board-card-actions relative z-10 flex min-w-0">
        {actions.map(action => (
          <CardActionButton key={action.label} action={action} main={action === main} />
        ))}
        {children}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

// A routine move stays quiet so the one urgent pill on the board is the only raised control.
function pillVariant(action: CardAction, main: boolean) {
  return main && action.urgent && !action.disabled ? 'primary' : 'ghost';
}

function CardActionButton({ action, main }: { action: CardAction; main: boolean }) {
  // The lead action keeps its label whole; a narrow column eats into the ones behind it.
  const width = main ? 'shrink-0' : 'min-w-0';
  return (
    <Button
      type="button"
      variant={pillVariant(action, main)}
      size="sm"
      aria-label={action.ariaLabel}
      disabled={action.disabled}
      className={width}
      onClick={() => action.start()}
    >
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
