import { Bell, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../../Badge';
import type { BadgeVariant } from '../../../Badge';
import { Txt } from '../../../Txt';
import { ActivityItem } from '../activity';
import { messagePreview, messagePreviewShowsAll } from './message-preview';

export interface NotificationActivityProps {
  label: string;
  message: string;
  state?: string;
  icon?: ReactNode;
  priority?: string;
  status?: string;
  pending?: string;
  link?: { href: string; label: string };
  defaultOpen?: boolean;
  /** Badges rendered after the priority, status and pending badges. */
  extraBadges?: ReactNode;
  /** A label shown above the message once opened, e.g. to flag it as untrusted. */
  messageLabel?: string;
}

const priorityBadgeVariants: Partial<Record<string, BadgeVariant>> = {
  urgent: 'red',
  high: 'orange',
  medium: 'blue',
};

export function NotificationActivity({
  label,
  message,
  state = 'notification',
  icon,
  priority,
  status,
  pending,
  link,
  defaultOpen,
  extraBadges,
  messageLabel,
}: NotificationActivityProps) {
  const lineHoldsMessage = messagePreviewShowsAll(message) && !messageLabel;
  const hasBadges = Boolean(priority || status || pending || extraBadges);

  return (
    <ActivityItem
      label={label}
      detail={messagePreview(message)}
      detailFont="sans"
      icon={icon ?? <Bell className="text-warning-foreground" aria-hidden />}
      badges={
        hasBadges && (
          <>
            {priority && (
              <Badge size="xs" variant={priorityBadgeVariants[priority]}>
                {priority}
              </Badge>
            )}
            {status && <Badge size="xs">{status}</Badge>}
            {pending && <Badge size="xs">{pending} pending</Badge>}
            {extraBadges}
          </>
        )
      }
      defaultOpen={defaultOpen}
      data-notification-state={state}
      aria-label={`Notification: ${label}`}
    >
      {(!lineHoldsMessage || link) && (
        <div className="flex flex-col gap-2">
          {messageLabel && (
            <Txt variant="caption" tone="muted">
              {messageLabel}
            </Txt>
          )}
          {message && (
            <Txt variant="caption" className="break-words whitespace-pre-wrap">
              {message}
            </Txt>
          )}
          {link && <NotificationLink link={link} message={message} />}
        </div>
      )}
    </ActivityItem>
  );
}

function NotificationLink({
  link,
  message,
}: {
  link: NonNullable<NotificationActivityProps['link']>;
  message: string;
}) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${link.label}: ${messagePreview(message)}`}
      className="flex w-fit items-center gap-1 text-meta text-muted-foreground hover:text-foreground"
    >
      {link.label}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
