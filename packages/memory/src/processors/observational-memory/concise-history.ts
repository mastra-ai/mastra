import type { MastraDBMessage } from '@mastra/core/agent';
import { estimateTokenCount } from 'tokenx';

import { formatToolResultForObserver, resolveToolResultValue, truncateStringByTokens } from './tool-result-helpers';

const USER_TEXT_TOKENS = 200;
const OTHER_TEXT_TOKENS = 50;
const TOOL_RESULT_TOKENS = 50;
const TOOL_RESULT_SERIALIZATION_TOKENS = 500;

function formatTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, 'Z');
}

function truncatePart(text: string, maxTokens: number): string {
  return estimateTokenCount(text) <= maxTokens ? text : truncateStringByTokens(text, maxTokens);
}

function formatPart(msg: MastraDBMessage, part: any): string | undefined {
  const partType = part?.type;

  if (partType === 'text') {
    return truncatePart(part.text ?? '', msg.role === 'user' ? USER_TEXT_TOKENS : OTHER_TEXT_TOKENS);
  }

  if (partType === 'tool-invocation') {
    const inv = part.toolInvocation;
    if (!inv) return undefined;

    if (inv.state === 'result') {
      const { value } = resolveToolResultValue(part as { providerMetadata?: Record<string, any> }, inv.result);
      const result = formatToolResultForObserver(value, { maxTokens: TOOL_RESULT_SERIALIZATION_TOKENS });
      return `[Tool Result: ${inv.toolName}] ${truncatePart(result, TOOL_RESULT_TOKENS)}`;
    }

    return `[Tool Call: ${inv.toolName}]`;
  }

  if (partType === 'reasoning' && typeof part.reasoning === 'string' && part.reasoning.trim()) {
    return truncatePart(part.reasoning, OTHER_TEXT_TOKENS);
  }

  if (partType === 'image') {
    return part.filename ? `[Image: ${part.filename}]` : '[Image]';
  }

  if (partType === 'file') {
    return part.filename ? `[File: ${part.filename}]` : '[File]';
  }

  if (typeof partType === 'string' && partType.startsWith('data-')) {
    return undefined;
  }

  return partType ? `[${partType}]` : undefined;
}

function formatMessage(msg: MastraDBMessage): string[] {
  const timestamp = msg.createdAt ? ` (${formatTimestamp(new Date(msg.createdAt))})` : '';
  const prefix = `**${msg.role}${timestamp}**:`;

  if (typeof msg.content === 'string') {
    const text = truncatePart(msg.content, msg.role === 'user' ? USER_TEXT_TOKENS : OTHER_TEXT_TOKENS);
    return text ? [`${prefix} ${text}`] : [];
  }

  const parts = msg.content?.parts;
  if (parts && Array.isArray(parts)) {
    return parts
      .map(part => formatPart(msg, part))
      .filter((value): value is string => !!value)
      .map(text => `${prefix} ${text}`);
  }

  const fallbackText = typeof msg.content?.content === 'string' ? msg.content.content : '';
  if (!fallbackText) {
    return [];
  }

  return [`${prefix} ${truncatePart(fallbackText, msg.role === 'user' ? USER_TEXT_TOKENS : OTHER_TEXT_TOKENS)}`];
}

export function formatConciseHistory(messages: MastraDBMessage[], options: { maxTokens: number }): string {
  if (!messages.length || options.maxTokens <= 0) {
    return '';
  }

  const rendered = messages.flatMap(formatMessage).filter(Boolean);
  if (!rendered.length) {
    return '';
  }

  let startIndex = 0;
  let text = rendered.join('\n');

  while (startIndex < rendered.length && estimateTokenCount(text) > options.maxTokens) {
    startIndex += 1;
    text = rendered.slice(startIndex).join('\n');
  }

  return estimateTokenCount(text) > options.maxTokens ? truncateStringByTokens(text, options.maxTokens) : text;
}
