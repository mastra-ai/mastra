import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Archive, ArchiveRestore, MailOpen, RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { factoryAttentionTargetPath } from '../services/attention';
import type { FactoryAttentionItem } from '../services/attention';
import { REVEAL_ON_CARD_HOVER } from './BoardCardParts';

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
  return (
    <div className="group hover:bg-surface4 relative flex flex-col px-3 py-2">
      <Link
        to={factoryAttentionTargetPath(factoryId, item.target)}
        onClick={onOpen}
        aria-label={`${destinationLabel(item)} for ${item.title}`}
        className="focus-visible:outline-accent1 absolute inset-0 rounded-md outline-none focus-visible:outline-2 focus-visible:-outline-offset-2"
      />
      <span className="flex items-center justify-between gap-2">
        <span className="text-ui-xs text-icon3 flex min-w-0 items-center gap-1.5">
          <TriangleAlert size={14} className="text-error shrink-0" aria-hidden />
          <span className="sr-only">{item.read ? 'Read' : 'Unread'}</span>
          {!item.read ? <span className="bg-warning1 size-1.5 shrink-0 rounded-full" aria-hidden /> : null}
          <span className="truncate">Automation failed · {relativeTime(item.occurredAt)}</span>
        </span>
        <span className={cn('relative flex items-center gap-0.5', REVEAL_ON_CARD_HOVER)}>
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
      <span className="text-ui-sm text-icon6 line-clamp-2 block font-medium wrap-anywhere">{item.title}</span>
      <span className="text-ui-xs text-icon3 mt-0.5 line-clamp-2 block wrap-anywhere">{item.detail}</span>
    </div>
  );
}
