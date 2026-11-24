import type { MessageList } from '../../agent/message-list';
import { aiV5UIMessagesToAIV5ModelMessages } from '../../agent/message-list/conversion/output-converter';

/** Where one accepted step's parts sit in the response message. */
export interface TranscriptStep {
  messageId: string;
  start: number;
  end: number;
}

export function getTranscriptStepContent(messageList: MessageList, step: TranscriptStep) {
  const message = messageList.get.response.aiV5.ui().find(message => message.id === step.messageId);
  if (!message) return [];
  return aiV5UIMessagesToAIV5ModelMessages(
    [{ ...message, parts: message.parts.slice(step.start, step.end) }],
    messageList.get.all.db(),
  ).flatMap(messageList.get.response.aiV5.stepContent);
}
