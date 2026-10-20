import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Hand, Maximize2, MessageSquare, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { BoardCardStatus } from '../boardCardState';
import {
  HIDDEN_CARD_LABELS,
  SOURCE_LABELS,
  metadataLabelColors,
  metadataLabels,
  pullRequestStatusForItem,
} from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { WorkItem, WorkItemSource } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

export function SourceTitle({ source, title, id }: { source: WorkItemSource; title: string; id?: string }) {
  return (
    <>
      <span className="sr-only">{SOURCE_LABELS[source]}: </span>
      <span id={id}>{title}</span>
    </>
  );
}

export function WorkItemSourceIcon({ item }: { item: WorkItem }) {
  if (item.source === 'github-pr') return <PullRequestStatusIcon status={pullRequestStatusForItem(item)} />;
  return <SourceIcon source={item.source} />;
}

// The app-wide provider fires at 0ms, which makes card-sized targets open as the pointer merely crosses them.
export function BoardTooltipDelay({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={400}>{children}</TooltipProvider>;
}

/**
 * Card chrome a hover can reveal: the click affordance and the actions menu.
 * Gated on `pointer-fine` because a touch screen has no hover to reveal it
 * with, and stays up while its menu is open.
 */
export const REVEAL_ON_CARD_HOVER =
  'transition-opacity duration-200 ease-out motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:aria-expanded:opacity-100';

// A mouse twin of the card's own details button, which keeps the keyboard and screen-reader path.
export function CardDetailsHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      draggable={false}
      onClick={onOpen}
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), REVEAL_ON_CARD_HOVER)}
    >
      <Maximize2 size={13} aria-hidden />
    </button>
  );
}

export function CommentCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Txt
      as="span"
      variant="meta"
      tone="faint"
      className="flex shrink-0 items-center gap-1"
      aria-label={`${count} ${count === 1 ? 'comment' : 'comments'}`}
    >
      <MessageSquare size={11} aria-hidden />
      {count}
    </Txt>
  );
}

/** `compact` keeps an error to one truncated line (for list rows) and moves the full text into the tooltip. */
export function CardStatus({ status, compact = false }: { status: BoardCardStatus; compact?: boolean }) {
  // A parked run is surfaced by the highlighted "Start suggested run" action, not a status badge.
  if (status.kind === 'idle' || status.kind === 'waiting') return null;

  if (status.kind === 'held') {
    return (
      <Badge size="xs" variant="orange" icon={<Hand aria-hidden />} role="status">
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
      <TriangleAlert size={11} aria-hidden className={cn('shrink-0', !compact && 'mt-0.5')} />
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

export function MetadataLabels({ metadata }: { metadata: Record<string, unknown> }) {
  const displayLabels = metadataLabels(metadata).filter(label => !HIDDEN_CARD_LABELS.has(label.toLowerCase()));
  if (displayLabels.length === 0) return null;
  const colors = metadataLabelColors(metadata);
  return (
    <ScrollArea orientation="horizontal" revealScrollbarOnHover={false} aria-label="Labels">
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
  beforeStart,
  trailing,
  children,
}: {
  actions: CardAction[];
  /** Runs before any button's `start`: the open copy hands back to the board with it. */
  beforeStart?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  if (actions.length === 0 && !children && !trailing) return null;
  const [main] = actions;
  return (
    <div className="mt-auto flex items-center justify-between gap-2">
      <div className="board-card-actions relative z-10 flex min-w-0">
        {actions.map(action => (
          <CardActionButton key={action.label} action={action} main={action === main} beforeStart={beforeStart} />
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

function CardActionButton({
  action,
  main,
  beforeStart,
}: {
  action: CardAction;
  main: boolean;
  beforeStart?: () => void;
}) {
  const variant = pillVariant(action, main);
  // The lead action keeps its label whole; a narrow column eats into the ones behind it.
  const width = main ? 'shrink-0' : 'min-w-0';
  // Both through Button, so the two pills can never differ by a class.
  if ('href' in action) {
    return (
      <Button
        as={Link}
        to={action.href}
        draggable={false}
        variant={variant}
        size="sm"
        aria-label={action.ariaLabel}
        className={width}
      >
        <span className="truncate">{action.label}</span>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={action.ariaLabel}
      disabled={action.disabled}
      className={width}
      onClick={() => {
        beforeStart?.();
        action.start();
      }}
    >
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
