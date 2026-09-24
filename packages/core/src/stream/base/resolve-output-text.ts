import { convertMessages, coreContentToString, type CoreMessageV4, type MessageList } from '../../agent/message-list';

/**
 * Text of the last assistant core message.
 *
 * Returns `undefined` when no assistant message exists, and `''` when one does
 * but has no text. Callers must not collapse those with a truthiness check: a
 * processor is allowed to clear the assistant text on purpose.
 */
function textOfLastAssistantMessage(messages: CoreMessageV4[]): string | undefined {
  const lastAssistant = messages.findLast(message => message.role === 'assistant');
  return lastAssistant ? coreContentToString(lastAssistant.content) : undefined;
}

/**
 * Resolve the processed output text, skipping trailing tool-result messages and
 * internal completion-check feedback.
 *
 * A step that ends with text plus a tool call is stored as an assistant message
 * followed by a `role: 'tool'` result. Reading whichever message happens to be
 * last turns that tool result into `''` and wipes `stream.text`. The assistant
 * message is the one output processors rewrite, so it is the text to keep.
 *
 * Completion-check messages are converted alone so they are not merged into the
 * real assistant message.
 */
export function resolveProcessedOutputText(messageList: MessageList): string | undefined {
  const responseDbMessages = messageList.get.response.db();
  const hasCompletionCheckMessages = responseDbMessages.some(message => message.content?.metadata?.completionResult);
  if (hasCompletionCheckMessages) {
    const lastRealMessage = responseDbMessages.findLast(message => !message.content?.metadata?.completionResult);
    const converted = lastRealMessage ? convertMessages([lastRealMessage]).to('AIV4.Core') : [];
    return textOfLastAssistantMessage(converted);
  }

  return textOfLastAssistantMessage(messageList.get.response.aiV4.core());
}
