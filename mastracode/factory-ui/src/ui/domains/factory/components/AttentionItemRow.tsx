import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Archive,
  ArchiveRestore,
  Brain,
  MailOpen,
  MessageSquare,
  MessagesSquare,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { attentionPrompt, supervisorAskPath } from '../../supervisor/services/supervisor';
import { attentionAuthorName, factoryAttentionTargetPath } from '../services/attention';
import type { FactoryAttentionItem } from '../services/attention';
import { TIMESTAMP } from './panel';
import { RAIL_ROW_BODY } from './Timeline';

/** What landed: the glyph the rail hangs the row off, and the word the row's badge wears. */
const KIND = {
  mention: { glyph: MessageSquare, label: 'mention', tone: 'text-accent1', badge: 'green' },
  activity: { glyph: MessagesSquare, label: 'comment', tone: 'text-icon3', badge: 'neutral' },
  'automation-failed': { glyph: TriangleAlert, label: 'failed', tone: 'text-error', badge: 'red' },
  'supervisor-finding': { glyph: Brain, label: 'finding', tone: 'text-accent1', badge: 'blue' },
} satisfies Record<
  FactoryAttentionItem['kind'],
  { glyph: typeof MessageSquare; label: string; tone: string; badge: BadgeVariant }
>;

/** Actions ride over the row's right end rather than displacing the time, so a hover never reflows the row. */
const REVEAL_ACTIONS =
  'bg-surface4 absolute top-1/2 right-0 hidden -translate-y-1/2 items-center gap-0.5 rounded-md pl-2 pointer-coarse:flex pointer-fine:group-hover:flex pointer-fine:group-focus-within:flex';

/** Kept in flow so nothing shifts; the action bar covers it. */
const MASKED_BY_ACTIONS =
  'pointer-coarse:invisible pointer-fine:group-hover:invisible pointer-fine:group-focus-within:invisible';

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
      size="icon-xs"
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
  updatingReceipt,
  onOpen,
  onRetry,
  onRead,
  onArchive,
  onRestore,
}: {
  factoryId: string;
  item: FactoryAttentionItem;
  retrying: boolean;
  updatingReceipt: boolean;
  onOpen?: () => void;
  onRetry?: () => void;
  onRead: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const navigate = useNavigate();
  const author = attentionAuthorName(item);

  return (
    <div className={cn('group relative flex flex-col py-2', RAIL_ROW_BODY)}>
      <Link
        to={factoryAttentionTargetPath(factoryId, item.target)}
        onClick={onOpen}
        aria-label={`${destinationLabel(item)} for ${item.title}`}
        className="focus-visible:outline-accent1 absolute inset-0 rounded-lg outline-none focus-visible:outline-2 focus-visible:-outline-offset-2"
      />
      <span className="flex w-full items-center gap-2">
        <span className="sr-only">{item.read ? 'Read' : 'Unread'}</span>
        <span className="text-ui-sm text-icon6 min-w-0 flex-1 truncate font-medium">{item.title}</span>
        <Badge
          variant={KIND[item.kind].badge}
          emphasis={item.read ? 'muted' : 'default'}
          size="xs"
          icon={createElement(KIND[item.kind].glyph)}
          className={MASKED_BY_ACTIONS}
        >
          {KIND[item.kind].label}
        </Badge>
        <span className="relative flex shrink-0 items-center">
          <time dateTime={item.occurredAt} className={TIMESTAMP}>
            {relativeTime(item.occurredAt)}
          </time>
          <span className={REVEAL_ACTIONS}>
            <Button
              variant="ghost"
              size="icon-xs"
              tooltip="Ask supervisor"
              aria-label={`Ask supervisor about ${item.title}`}
              onClick={() => {
                onOpen?.();
                void navigate(supervisorAskPath(factoryId, attentionPrompt(item)));
              }}
            >
              <Brain aria-hidden />
            </Button>
            {onRetry ? (
              <RowAction
                tooltip="Retry"
                label={`${retrying ? 'Retrying' : 'Retry'} ${item.title}`}
                disabled={retrying}
                onClick={onRetry}
              >
                {retrying ? <Spinner size="sm" aria-hidden className="size-3.5" /> : <RotateCw aria-hidden />}
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
              <RowAction
                tooltip="Restore"
                label={`Restore ${item.title}`}
                disabled={updatingReceipt}
                onClick={onRestore}
              >
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
      </span>
      <span className="text-ui-xs text-icon3 truncate">
        {author ? <span className="text-icon4 font-medium">{author} </span> : null}
        {item.detail}
      </span>
    </div>
  );
}
