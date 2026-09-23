import { formatSignalValue, getNotificationMetadata, signalContentsToText } from './signal-data';
import type { SignalData } from './signal-data';
import { ChatNotification } from '@/ds/components/ai/chat-event';

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
  return (
    <ChatNotification
      variant="notice"
      label={getNotificationTitle(signal)}
      message={text}
      priority={priority}
      status={status}
      pending={pending}
    />
  );
};
