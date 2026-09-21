import { Bell, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChatEvent } from './chat-event';
import { chatEventPreview } from './chat-event-preview';
import { getNotificationNoticeVariant } from './notification-variant';
import { Badge } from '@/ds/components/Badge';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

export interface ChatNotificationProps {
  label: string;
  message: string;
  variant?: 'row' | 'notice';
  state?: string;
  icon?: ReactNode;
  priority?: string;
  status?: string;
  pending?: string;
  link?: { href: string; label: string };
  defaultOpen?: boolean;
}

export function ChatNotification({
  label,
  message,
  variant = 'row',
  state = 'notification',
  icon,
  priority,
  status,
  pending,
  link,
  defaultOpen,
}: ChatNotificationProps) {
  if (variant === 'notice') {
    const hasContent = Boolean(priority || status || pending || message || link);
    return (
      <Notice
        variant={getNotificationNoticeVariant(priority)}
        title={label}
        icon={icon ?? <Bell />}
        className="my-2 max-w-[80%]"
      >
        {hasContent && (
          <div className="flex flex-col gap-2">
            {(priority || status || pending) && (
              <div className="flex flex-wrap items-center gap-2">
                {priority && <Badge size="xs">{priority}</Badge>}
                {status && <Badge size="xs">{status}</Badge>}
                {pending && <Badge size="xs">{pending} pending</Badge>}
              </div>
            )}
            {message && <Notice.Message className="break-words whitespace-pre-wrap">{message}</Notice.Message>}
            {link && <NotificationLink link={link} message={message} />}
          </div>
        )}
      </Notice>
    );
  }

  return (
    <ChatEvent
      label={label}
      detail={chatEventPreview(message)}
      icon={icon ?? <Bell size={13} className="text-warning1" aria-hidden />}
      defaultOpen={defaultOpen}
      data-notification-state={state}
      aria-label={`Notification: ${label}`}
    >
      <div className="flex flex-col gap-2">
        <Txt variant="caption">{message}</Txt>
        {link && <NotificationLink link={link} message={message} />}
      </div>
    </ChatEvent>
  );
}

function NotificationLink({ link, message }: { link: NonNullable<ChatNotificationProps['link']>; message: string }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open notification target: ${message}`}
      className="text-icon3 hover:text-icon5 text-meta flex w-fit items-center gap-1"
    >
      {link.label}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
