import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Bell } from 'lucide-react';

import { getNotificationNoticeVariant } from './notification-signal-notice-variant';
import { formatSignalValue, getNotificationMetadata, signalContentsToText } from './signal-data';
import type { SignalData } from './signal-data';

export type NotificationSignalNoticeProps = {
  signal: SignalData;
};

const getNotificationTitle = (signal: SignalData) => {
  const notification = getNotificationMetadata(signal);
  if (notification?.signal === 'summary' || signal.tagName === 'notification-summary') return 'Notification summary';

  const source = notification?.source ?? formatSignalValue(signal.attributes?.source);
  const kind = notification?.kind ?? formatSignalValue(signal.attributes?.kind);
  if (source && kind) return `${source} / ${kind}`;
  return source ?? kind ?? 'Notification';
};

export const NotificationSignalNotice = ({ signal }: NotificationSignalNoticeProps) => {
  const notification = getNotificationMetadata(signal);
  const priority = notification?.priority ?? formatSignalValue(signal.attributes?.priority);
  const pending = formatSignalValue(notification?.pending) ?? formatSignalValue(signal.attributes?.pending);
  const status = notification?.status ?? formatSignalValue(signal.attributes?.status);
  const text = signalContentsToText(signal.contents);
  const pendingLabel = pending ? `${pending} pending` : undefined;
  const hasMetadata = Boolean(priority || status || pendingLabel);
  const hasText = text.length > 0;

  return (
    <Notice
      variant={getNotificationNoticeVariant(priority)}
      title={getNotificationTitle(signal)}
      icon={<Bell />}
      className="my-2 max-w-[80%]"
    >
      {hasMetadata || hasText ? (
        <div className="flex flex-col gap-2">
          {hasMetadata ? (
            <div className="flex flex-wrap items-center gap-2">
              {priority ? <Badge size="xs">{priority}</Badge> : null}
              {status ? <Badge size="xs">{status}</Badge> : null}
              {pendingLabel ? <Badge size="xs">{pendingLabel}</Badge> : null}
            </div>
          ) : null}
          {hasText ? <Notice.Message className="whitespace-pre-wrap break-words">{text}</Notice.Message> : null}
        </div>
      ) : null}
    </Notice>
  );
};
