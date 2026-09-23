import { Bell, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { chatEventPreview, chatEventPreviewShowsAll } from './chat-event-preview';
import { ActivityItem } from '@/ds/components/ai/activity';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

export interface ChatNotificationProps {
  label: string;
  message: string;
  state?: string;
  icon?: ReactNode;
  priority?: string;
  status?: string;
  pending?: string;
  link?: { href: string; label: string };
  defaultOpen?: boolean;
}

const priorityBadgeVariants: Partial<Record<string, BadgeVariant>> = {
  urgent: 'red',
  high: 'orange',
  medium: 'blue',
};

export function ChatNotification({
  label,
  message,
  state = 'notification',
  icon,
  priority,
  status,
  pending,
  link,
  defaultOpen,
}: ChatNotificationProps) {
  const lineHoldsMessage = chatEventPreviewShowsAll(message);
  const hasBadges = Boolean(priority || status || pending);

  return (
    <ActivityItem
      label={label}
      detail={chatEventPreview(message)}
      detailFont="sans"
      icon={icon ?? <Bell className="text-warning1" aria-hidden />}
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
          </>
        )
      }
      defaultOpen={defaultOpen}
      data-notification-state={state}
      aria-label={`Notification: ${label}`}
    >
      {(!lineHoldsMessage || link) && (
        <div className="flex flex-col gap-2">
          {!lineHoldsMessage && <Txt variant="caption">{message}</Txt>}
          {link && <NotificationLink link={link} message={message} />}
        </div>
      )}
    </ActivityItem>
  );
}

function NotificationLink({ link, message }: { link: NonNullable<ChatNotificationProps['link']>; message: string }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open notification target: ${message}`}
      className="flex w-fit items-center gap-1 text-meta text-muted-foreground hover:text-foreground"
    >
      {link.label}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
