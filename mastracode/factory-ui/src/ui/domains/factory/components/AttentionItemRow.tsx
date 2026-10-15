import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Archive,
  ArchiveRestore,
  Brain,
  Check,
  Hourglass,
  MailOpen,
  MessageSquare,
  MessagesSquare,
  RotateCw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { attentionPrompt, supervisorAskPath } from '../../supervisor/services/supervisor';
import { attentionAuthorName, factoryAttentionTargetPath, readableAttentionDetail } from '../services/attention';
import type { FactoryAttentionItem } from '../services/attention';
import { RAIL_ROW_BODY } from './Timeline';
import { Txt } from '@mastra/playground-ui/components/Txt';

/** What landed: the glyph the rail hangs the row off, and the word the row's badge wears. */
const KIND = {
  mention: { glyph: MessageSquare, label: 'mention', tone: 'text-badge-green-indicator', badge: 'green' },
  activity: { glyph: MessagesSquare, label: 'comment', tone: 'text-muted-foreground', badge: 'neutral' },
  'automation-failed': {
    glyph: TriangleAlert,
    label: 'failed',
    tone: 'text-destructive-foreground',
    badge: 'destructive',
  },
  'automation-proposed': {
    glyph: Sparkles,
    label: 'suggested',
    tone: 'text-warning-foreground',
    badge: 'orange',
  },
  'supervisor-finding': { glyph: Brain, label: 'finding', tone: 'text-badge-green-indicator', badge: 'blue' },
  'agent-waiting': {
    glyph: Hourglass,
    label: 'waiting',
    tone: 'text-warning-foreground',
    badge: 'orange',
  },
} satisfies Record<
  FactoryAttentionItem['kind'],
  { glyph: typeof MessageSquare; label: string; tone: string; badge: BadgeVariant }
>;

/** Meta and actions stack in one grid cell sized to the wider of the two, so a hover swaps them without reflow or overlap. */
const SWAP_SLOT =
  'relative grid shrink-0 items-center justify-items-end [grid-template-areas:"slot"] *:[grid-area:slot]';

const HIDDEN_ON_REVEAL =
  'transition-opacity duration-150 pointer-coarse:opacity-0 pointer-fine:group-hover:opacity-0 pointer-fine:group-focus-within:opacity-0';

const SHOWN_ON_REVEAL =
  'flex items-center gap-0.5 transition-opacity duration-150 pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover:pointer-events-auto pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:pointer-events-auto pointer-fine:group-focus-within:opacity-100';

export function KindIcon({ kind }: { kind: FactoryAttentionItem['kind'] }): ReactElement {
  return createElement(KIND[kind].glyph, { size: 14, className: cn('shrink-0', KIND[kind].tone), 'aria-hidden': true });
}

function destinationLabel(item: FactoryAttentionItem): string {
  if (item.target.kind === 'thread') return 'Open thread';
  if (item.target.kind === 'work-item') return 'View card';
  return 'View rules';
}

function RowAction({
  tooltip,
  label,
  disabled,
  onClick,
  children,
}: {
  tooltip: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      tooltip={tooltip}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function AttentionItemRow({
  factoryId,
  item,
  retrying,
  settling,
  updatingReceipt,
  onOpen,
  onRetry,
  onChooseRepository,
  onApprove,
  onDismiss,
  onRead,
  onArchive,
  onRestore,
}: {
  factoryId: string;
  item: FactoryAttentionItem;
  retrying: boolean;
  settling: boolean;
  updatingReceipt: boolean;
  onOpen?: () => void;
  onRetry?: () => void;
  onChooseRepository?: () => void;
  onApprove?: () => void;
  onDismiss?: () => void;
  onRead: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const navigate = useNavigate();
  const author = attentionAuthorName(item);

  return (
    <div className={cn('group relative flex items-center gap-3 py-2', RAIL_ROW_BODY)}>
      <Link
        to={factoryAttentionTargetPath(factoryId, item.target)}
        onClick={onOpen}
        aria-label={`${destinationLabel(item)} for ${item.title}`}
        className={`absolute inset-0 rounded-lg ${focusRingInset}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="sr-only">{item.read ? 'Read' : 'Unread'}</span>
        <Txt as="span" variant="column" tone="ink" className="truncate">
          {item.title}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="truncate">
          {author ? (
            <Txt as="span" variant="meta" tone="muted">
              {author}{' '}
            </Txt>
          ) : null}
          {readableAttentionDetail(item.detail)}
        </Txt>
      </span>
      <span className={SWAP_SLOT}>
        <span className={cn('flex items-center gap-2', HIDDEN_ON_REVEAL)}>
          <Badge
            variant={KIND[item.kind].badge}
            emphasis={item.read ? 'subtle' : 'strong'}
            size="xs"
            icon={createElement(KIND[item.kind].glyph)}
          >
            {KIND[item.kind].label}
          </Badge>
          <Txt as="time" variant="meta" tone="muted" font="mono" dateTime={item.occurredAt}>
            {relativeTime(item.occurredAt)}
          </Txt>
        </span>
        <span className={SHOWN_ON_REVEAL}>
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip="Ask supervisor"
            aria-label={`Ask supervisor about ${item.title}`}
            onClick={() => {
              onOpen?.();
              void navigate(supervisorAskPath(factoryId, attentionPrompt(item)));
            }}
          >
            <Brain aria-hidden />
          </Button>
          {onChooseRepository ? (
            <RowAction
              tooltip="Choose repository"
              label={`Choose repository for ${item.title}`}
              disabled={retrying}
              onClick={onChooseRepository}
            >
              <RotateCw aria-hidden />
            </RowAction>
          ) : null}
          {onRetry && !onChooseRepository ? (
            <RowAction
              tooltip="Retry"
              label={`${retrying ? 'Retrying' : 'Retry'} ${item.title}`}
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? <Spinner size="sm" aria-hidden className="size-3.5" /> : <RotateCw aria-hidden />}
            </RowAction>
          ) : null}
          {onApprove ? (
            <RowAction tooltip="Run it" label={`Run ${item.title}`} disabled={settling} onClick={onApprove}>
              {settling ? <Spinner size="sm" aria-hidden className="size-3.5" /> : <Check aria-hidden />}
            </RowAction>
          ) : null}
          {onDismiss ? (
            <RowAction tooltip="Dismiss" label={`Dismiss ${item.title}`} disabled={settling} onClick={onDismiss}>
              <X aria-hidden />
            </RowAction>
          ) : null}
          {!item.read ? (
            <RowAction
              tooltip="Mark as read"
              label={`Mark ${item.title} as read`}
              disabled={updatingReceipt}
              onClick={onRead}
            >
              <MailOpen aria-hidden />
            </RowAction>
          ) : null}
          {item.archived ? (
            <RowAction tooltip="Restore" label={`Restore ${item.title}`} disabled={updatingReceipt} onClick={onRestore}>
              <ArchiveRestore aria-hidden />
            </RowAction>
          ) : (
            <RowAction
              tooltip="Archive for me"
              label={`Archive ${item.title}`}
              disabled={updatingReceipt}
              onClick={onArchive}
            >
              <Archive aria-hidden />
            </RowAction>
          )}
        </span>
      </span>
    </div>
  );
}
