import type { MastraDBMessage } from '@mastra/core/agent';
import type { ProcessInputStepArgs } from '@mastra/core/processors';

import { formatTemporalGap, formatTemporalTimestamp, getMessagePartTimestamp, isTemporalGapMarker } from './date-utils';

export const TEMPORAL_GAP_REMINDER_TYPE = 'temporal-gap';

function getTemporalGapReminderText(gapText: string, timestamp: number): string {
  return `${gapText} — ${formatTemporalTimestamp(new Date(timestamp))}`;
}

function getTemporalGapReminderMetadata(message: MastraDBMessage, gapText: string, gapMs: number, timestamp: number) {
  return {
    reminderType: TEMPORAL_GAP_REMINDER_TYPE,
    gapText,
    gapMs,
    timestamp: formatTemporalTimestamp(new Date(timestamp)),
    precedesMessageId: message.id,
  };
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

  const check = messageList.makeMessageSourceChecker();
  const allMessages = messageList.get.all.db().filter((message): message is MastraDBMessage => Boolean(message));
  const latestInputIndex = allMessages.findIndex(message => message.id === latestInputMessage.id);

  if (latestInputIndex <= 0) {
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
  const rebuiltMessages = [...allMessages];
  rebuiltMessages.splice(latestInputIndex, 0, marker);

  messageList.clear.all.db();
  for (const message of rebuiltMessages) {
    messageList.add(message, message === marker ? 'input' : (check.getSource(message) ?? 'memory'));
  }
}
