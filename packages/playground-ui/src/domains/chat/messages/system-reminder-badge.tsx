import { useMemo } from 'react';
import { parseSystemReminder } from './system-reminder-utils';
import { ChatSignal } from '@/ds/components/ai/chat-event';

export interface SystemReminderBadgeProps {
  text: string;
}

export const SystemReminderBadge = ({ text }: SystemReminderBadgeProps) => {
  const reminder = useMemo(() => parseSystemReminder(text), [text]);

  if (!reminder) {
    return text;
  }

  return (
    <ChatSignal
      variant="card"
      collapsible
      kind="reminder"
      label="System reminder"
      detail={reminder.path || reminder.type}
      message={reminder.body}
    />
  );
};
