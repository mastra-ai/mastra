import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';

import { formatTemporalGap, formatTemporalTimestamp, getMessagePartTimestamp, isTemporalGapMarker } from './date-utils';

export const TEMPORAL_GAP_REMINDER_TYPE = 'temporal-gap';

function getTemporalGapReminderText(gapText: string, timestamp: number): string {
  return `${gapText} — ${formatTemporalTimestamp(new Date(timestamp))}`;
}

function getTemporalGapReminderMetadata(message: MastraDBMessage, gapText: string, gapMs: number, timestamp: number) {
  const formattedTimestamp = formatTemporalTimestamp(new Date(timestamp));

  return {
    reminderType: TEMPORAL_GAP_REMINDER_TYPE,
    gapText,
    gapMs,
    timestamp: formattedTimestamp,
    timestampMs: timestamp,
    precedesMessageId: message.id,
    systemReminder: {
      type: TEMPORAL_GAP_REMINDER_TYPE,
      message: getTemporalGapReminderText(gapText, timestamp),
      gapText,
      gapMs,
      timestamp: formattedTimestamp,
      timestampMs: timestamp,
      precedesMessageId: message.id,
    },
  };
}

function isTemporalGapMarkerForMessage(message: MastraDBMessage, targetMessageId: string): boolean {
  if (!isTemporalGapMarker(message)) {
    return false;
  }

  const metadata = message.content.metadata as
    | {
        precedesMessageId?: unknown;
        systemReminder?: { type?: unknown; precedesMessageId?: unknown };
      }
    | undefined;

  if (metadata?.precedesMessageId === targetMessageId) {
    return true;
  }

  return (
    metadata?.systemReminder?.type === TEMPORAL_GAP_REMINDER_TYPE &&
    metadata.systemReminder.precedesMessageId === targetMessageId
  );
}

function createTemporalGapMarker(
  message: MastraDBMessage,
  gapText: string,
  gapMs: number,
  timestamp: number,
): MastraDBMessage {
  const metadata = getTemporalGapReminderMetadata(message, gapText, gapMs, timestamp);

  return {
    id: `__temporal_gap_${crypto.randomUUID()}`,
    role: 'user',
    createdAt: new Date(timestamp - 1),
    threadId: message.threadId,
    resourceId: message.resourceId,
    content: {
      format: 2,
      parts: [
        {
          type: 'text',
          text: `<system-reminder type="${TEMPORAL_GAP_REMINDER_TYPE}" precedesMessageId="${message.id}">${getTemporalGapReminderText(gapText, timestamp)}</system-reminder>`,
        },
      ],
      metadata,
    },
  };
}

export async function insertTemporalGapMarkers({
  messageList,
  writer,
}: Pick<ProcessInputStepArgs, 'messageList' | 'writer'>): Promise<void> {
  const inputMessages = messageList.get.input.db().filter((message): message is MastraDBMessage => Boolean(message));
  const latestInputMessage = inputMessages.at(-1);

  if (!latestInputMessage || isTemporalGapMarker(latestInputMessage)) {
    return;
  }

  const allMessages = messageList.get.all.db().filter((message): message is MastraDBMessage => Boolean(message));
  const latestInputIndex = allMessages.findIndex(message => message.id === latestInputMessage.id);

  if (latestInputIndex <= 0) {
    return;
  }

  if (allMessages.some(message => isTemporalGapMarkerForMessage(message, latestInputMessage.id))) {
    return;
  }

  let previousNonMarker: MastraDBMessage | undefined;
  for (let index = latestInputIndex - 1; index >= 0; index--) {
    const candidate = allMessages[index];
    if (candidate && !isTemporalGapMarker(candidate)) {
      previousNonMarker = candidate;
      break;
    }
  }

  if (!previousNonMarker) {
    return;
  }

  const timestamp = getMessagePartTimestamp(latestInputMessage, 'first');
  const gapMs = timestamp - getMessagePartTimestamp(previousNonMarker, 'last');
  const gapText = formatTemporalGap(gapMs);

  if (!gapText) {
    return;
  }

  const reminderMetadata = getTemporalGapReminderMetadata(latestInputMessage, gapText, gapMs, timestamp);

  await writer?.custom({
    type: 'data-system-reminder',
    data: {
      message: getTemporalGapReminderText(gapText, timestamp),
      ...reminderMetadata,
    },
    transient: true,
  });

  const marker = createTemporalGapMarker(latestInputMessage, gapText, gapMs, timestamp);
  messageList.add(marker, 'input');
}
