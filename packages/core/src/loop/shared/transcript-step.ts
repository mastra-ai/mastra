import { z } from 'zod/v4';
import type { MessageList } from '../../agent/message-list';
import { aiV5UIMessagesToAIV5ModelMessages } from '../../agent/message-list/conversion/output-converter';
import { StepContentExtractor } from '../../agent/message-list/conversion/step-content';

/** Where one accepted step's parts sit in the response message. */
export const transcriptStepSchema = z.object({
  messageId: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type TranscriptStep = z.infer<typeof transcriptStepSchema>;

export function getTranscriptStepContent(messageList: MessageList, step?: TranscriptStep) {
  // The response partition used for pending saves is drained between steps.
  const messages = messageList.getPersisted.response.aiV5.ui();
  if (!step) {
    // Snapshots written before step positions were persisted still have step-start markers.
    return StepContentExtractor.extractStepContent(messages, -1, messageList.get.response.aiV5.stepContent);
  }
  const message = messages.find(message => message.id === step.messageId);
  if (!message) return [];
  return aiV5UIMessagesToAIV5ModelMessages(
    [{ ...message, parts: message.parts.slice(step.start, step.end) }],
    messageList.get.all.db(),
  ).flatMap(messageList.get.response.aiV5.stepContent);
}
