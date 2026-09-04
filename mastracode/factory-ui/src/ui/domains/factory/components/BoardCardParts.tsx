import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Hand, Maximize2, Sparkles, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { BoardCardStatus } from '../boardCardStatus';
import { HIDDEN_CARD_LABELS, SOURCE_LABELS } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { WorkItemSource } from '../services/workItems';

export function SourceTitle({ source, title, id }: { source: WorkItemSource; title: string; id?: string }) {
  return (
    <>
      <span className="sr-only">{SOURCE_LABELS[source]}: </span>
      <span id={id}>{title}</span>
    </>
  );
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

// Beside the card's menu, in the slot where the open copy puts Collapse; the click falls through to the card.
export function CardDetailsHint() {
  return (
    <span
      aria-hidden
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'pointer-events-none', REVEAL_ON_CARD_HOVER)}
    >
      <Maximize2 size={13} aria-hidden />
    </span>
  );
}

export function CardStatus({ status }: { status: BoardCardStatus }) {
  if (status.kind === 'idle') return null;

  // A parked run is the one idle state the card cannot whisper: it needs the
  // user, so it stays lit without a hover. Releasing it is the actions row's job.
  if (status.kind === 'waiting') {
    return (
      <Badge size="xs" variant="orange" icon={<Sparkles aria-hidden />} role="status" aria-live="polite">
        Suggested: {status.label}
      </Badge>
    );
  }

  if (status.kind === 'held') {
    return (
      <Badge size="xs" variant="orange" icon={<Hand aria-hidden />} role="status">
        {status.label}
      </Badge>
    );
  }

  if (status.kind === 'busy') {
    return (
      <span role="status" aria-live="polite" className="text-ui-xs text-icon4 flex shrink-0 items-center gap-1.5">
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
        'text-ui-xs text-error flex w-full min-w-0 items-start gap-1.5',
        status.detail !== undefined &&
          'focus-visible:outline-accent1 relative cursor-help underline decoration-dotted underline-offset-2 outline-none focus-visible:outline-2',
      )}
    >
      <TriangleAlert size={11} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 wrap-anywhere">{status.label}</span>
    </span>
  );

  if (status.detail === undefined) return message;
  // Raw failure text stays one hover away instead of costing a row.
  return (
    <Tooltip>
      <TooltipTrigger render={message} />
      <TooltipContent side="top" className="max-w-80">
        <span className="wrap-anywhere whitespace-pre-wrap">{status.detail}</span>
      </TooltipContent>
    </Tooltip>
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
  return (
    <ScrollArea orientation="horizontal" revealScrollbarOnHover={false} aria-label="Labels">
      <div className="flex items-center gap-1.5">
        {displayLabels.map(label => (
          <span
            key={label}
            className="border-border1 text-ui-xs text-icon4 inline-flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border px-1.5"
            title={label}
          >
            <span className={cn('size-1 shrink-0 rounded-full', labelDotClass(label))} aria-hidden />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>
    </ScrollArea>
  );
}

/** Pinned to the card's bottom: the likeliest click first, lit only while the card waits on a person, the rest stacked under it, `trailing` at the right. */
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
      <div className="board-card-actions relative z-10 flex">
        {actions.map(action => (
          <CardActionButton key={action.label} action={action} main={action === main} beforeStart={beforeStart} />
        ))}
        {children}
      </div>
      {trailing}
    </div>
  );
}

function pillVariant(action: CardAction, main: boolean) {
  if (!main) return 'outline';
  if (action.urgent && !action.disabled) return 'primary';
  return 'default';
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
  // Both through Button, so the two pills can never differ by a class.
  if ('href' in action) {
    return (
      <Button as={Link} to={action.href} draggable={false} variant={variant} size="sm" aria-label={action.ariaLabel}>
        {action.label}
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
      onClick={() => {
        beforeStart?.();
        action.start();
      }}
    >
      {action.label}
    </Button>
  );
}
