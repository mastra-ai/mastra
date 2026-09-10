import type { MastraDBMessage } from '../agent/message-list';
import type { AgentSignalType } from '../agent/signals';

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

export function isSystemReminderSignalType(type: unknown): boolean {
  return type === 'system-reminder' || type === 'reactive';
}

export function isSystemReminderMessage(message: MastraDBMessage): boolean {
  if (!isRecord(message.content)) {
    return false;
  }

  const metadata = message.content.metadata;
  if (message.role === 'signal') {
    return isRecord(metadata) && isRecord(metadata.signal) && isSystemReminderSignalType(metadata.signal.type);
  }

  if (message.role !== 'user') {
    return false;
  }

  if (isRecord(metadata) && (isRecord(metadata.systemReminder) || LEGACY_SYSTEM_REMINDER_METADATA_KEY in metadata)) {
    return true;
  }

  const firstTextPart = message.content.parts.find(part => part.type === 'text');
  return typeof firstTextPart?.text === 'string' && firstTextPart.text.startsWith('<system-reminder');
}

function isRecallSignalType(type: unknown): type is AgentSignalType {
  return (
    type === 'user' ||
    type === 'state' ||
    type === 'reactive' ||
    type === 'notification' ||
    type === 'user-message' ||
    type === 'system-reminder'
  );
}

function getRecallSignalType(message: MastraDBMessage): AgentSignalType | undefined {
  if (!isRecord(message.content)) return undefined;

  for (const part of message.content.parts) {
    if (
      (part.type === 'data-signal' || part.type === 'data-user-message') &&
      isRecord(part.data) &&
      isRecallSignalType(part.data.type)
    ) {
      return part.data.type;
    }
  }

  const metadata = message.content.metadata;
  if (message.role === 'signal' && isRecord(metadata) && isRecord(metadata.signal)) {
    if (isRecallSignalType(metadata.signal.type)) return metadata.signal.type;
  }

  return isSystemReminderMessage(message) ? 'system-reminder' : undefined;
}

export function filterSystemReminderMessages(
  messages: MastraDBMessage[],
  includeSystemReminders?: boolean,
  excludeSignals?: AgentSignalType[],
): MastraDBMessage[] {
  if (excludeSignals !== undefined) {
    return messages.filter(message => {
      const type = getRecallSignalType(message);
      return type === undefined || !excludeSignals.includes(type);
    });
  }

  // TODO: In the next breaking release, align the history default with streams (exclude none).
  if (includeSystemReminders) {
    return messages;
  }

  return messages.filter(message => !isSystemReminderMessage(message));
}
