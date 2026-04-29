import type { MastraDBMessage } from '../agent/message-list';

/*
 * Compatibility note: @mastra/memory intentionally copies the helpers in this
 * file into packages/memory/src/index.ts instead of importing them. Its peer
 * range permits older core versions that do not export these newer names, and
 * importing them can crash published memory builds during ESM instantiation.
 * Until v2 can tighten that peer contract, keep both sides manually in sync.
 */

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
