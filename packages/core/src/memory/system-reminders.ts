import type { MastraDBMessage } from '../agent/message-list';

const LEGACY_SYSTEM_REMINDER_METADATA_KEY = 'dynamicAgentsMdReminder';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSystemReminderMessage(message: MastraDBMessage): boolean {
  if (message.role !== 'user' || !isRecord(message.content)) {
    return false;
  }

  const metadata = message.content.metadata;
  if (isRecord(metadata) && (isRecord(metadata.systemReminder) || LEGACY_SYSTEM_REMINDER_METADATA_KEY in metadata)) {
    return true;
  }

  const firstTextPart = message.content.parts.find(part => part.type === 'text');
  return typeof firstTextPart?.text === 'string' && firstTextPart.text.startsWith('<system-reminder');
}

export function filterSystemReminderMessages(
  messages: MastraDBMessage[],
  includeSystemReminders?: boolean,
): MastraDBMessage[] {
  if (includeSystemReminders) {
    return messages;
  }

  return messages.filter(message => !isSystemReminderMessage(message));
}
