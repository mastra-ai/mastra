import type { MastraDBMessage } from '@mastra/core/agent';
import { estimateTokenCount } from 'tokenx';

import { buildRenderedText, formatMessageParts } from './recall';
import { truncateStringByTokens } from './tool-result-helpers';

export function formatConciseHistory(messages: MastraDBMessage[], options: { maxTokens: number }): string {
  if (!messages.length || options.maxTokens <= 0) {
    return '';
  }

  const parts = messages.flatMap(message => formatMessageParts(message, 'low'));
  if (!parts.length) {
    return '';
  }

  const timestamps = new Map(messages.map(message => [message.id, new Date(message.createdAt)]));
  let startIndex = 0;
  let text = buildRenderedText(parts, timestamps);

  while (startIndex < parts.length && estimateTokenCount(text) > options.maxTokens) {
    const nextMessageId = parts[startIndex]?.messageId;
    while (startIndex < parts.length && parts[startIndex]?.messageId === nextMessageId) {
      startIndex += 1;
    }
    text = buildRenderedText(parts.slice(startIndex), timestamps);
  }

  return estimateTokenCount(text) > options.maxTokens ? truncateStringByTokens(text, options.maxTokens) : text;
}
