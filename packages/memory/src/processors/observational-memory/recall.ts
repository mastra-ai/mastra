import type { MastraDBMessage } from '@mastra/core/agent';
import { estimateTokenCount } from 'tokenx';

import { formatToolResultForObserver, resolveToolResultValue, truncateStringByTokens } from './tool-result-helpers';

export type RecallDetail = 'low' | 'high';

const LOW_DETAIL_PART_TOKENS = 30;
const AUTO_EXPAND_TEXT_TOKENS = 100;
const AUTO_EXPAND_TOOL_TOKENS = 20;
const HIGH_DETAIL_TOOL_RESULT_TOKENS = 4000;

function getMessageParts(msg: MastraDBMessage): any[] {
  if (typeof msg.content === 'string') return [];
  if (Array.isArray(msg.content)) return msg.content;
  const parts = msg.content?.parts;
  return Array.isArray(parts) ? parts : [];
}

export function formatTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, 'Z');
}

export interface FormattedPart {
  messageId: string;
  partIndex: number;
  role: string;
  type: string;
  text: string;
  /** Full untruncated text — used for auto-expand when token budget allows */
  fullText: string;
  toolName?: string;
}

export function truncateByTokens(
  text: string,
  maxTokens: number,
  hint?: string,
): { text: string; wasTruncated: boolean } {
  if (estimateTokenCount(text) <= maxTokens) return { text, wasTruncated: false };
  const truncated = truncateStringByTokens(text, maxTokens);
  const suffix = hint ? ` [${hint} for more]` : '';
  return { text: truncated + suffix, wasTruncated: true };
}

export function lowDetailPartLimit(type: string): number {
  if (type === 'text') return AUTO_EXPAND_TEXT_TOKENS;
  if (type === 'tool-result' || type === 'tool-call') return AUTO_EXPAND_TOOL_TOKENS;
  return LOW_DETAIL_PART_TOKENS;
}

export function makePart(
  msg: MastraDBMessage,
  partIndex: number,
  type: string,
  fullText: string,
  detail: RecallDetail,
  toolName?: string,
): FormattedPart {
  if (detail === 'high') {
    return { messageId: msg.id, partIndex, role: msg.role, type, text: fullText, fullText, toolName };
  }
  const hint = `recall cursor="${msg.id}" partIndex=${partIndex} detail="high"`;
  const { text } = truncateByTokens(fullText, lowDetailPartLimit(type), hint);
  return { messageId: msg.id, partIndex, role: msg.role, type, text, fullText, toolName };
}

export function formatMessageParts(msg: MastraDBMessage, detail: RecallDetail): FormattedPart[] {
  const parts: FormattedPart[] = [];

  if (typeof msg.content === 'string') {
    parts.push(makePart(msg, 0, 'text', msg.content, detail));
    return parts;
  }

  const messageParts = getMessageParts(msg);
  if (messageParts.length > 0) {
    for (let i = 0; i < messageParts.length; i++) {
      const part = messageParts[i]!;
      const partType = (part as { type?: string }).type;

      if (partType === 'text') {
        const text = (part as { text?: string }).text;
        if (text) {
          parts.push(makePart(msg, i, 'text', text, detail));
        }
      } else if (partType === 'tool-invocation') {
        const inv = (part as any).toolInvocation;
        if (inv?.toolName) {
          const hasArgs = inv.args != null;
          if (inv.state !== 'partial-call' && hasArgs) {
            const argsStr = detail === 'low' ? '' : `\n${JSON.stringify(inv.args, null, 2)}`;
            const fullText = `[Tool Call: ${inv.toolName}]${argsStr}`;
            parts.push({
              messageId: msg.id,
              partIndex: i,
              role: msg.role,
              type: 'tool-call',
              text: fullText,
              fullText,
              toolName: inv.toolName,
            });
          }

          if (inv.state === 'result') {
            const { value: resultValue } = resolveToolResultValue(
              part as { providerMetadata?: Record<string, any> },
              inv.result,
            );
            const resultStr = formatToolResultForObserver(resultValue, { maxTokens: HIGH_DETAIL_TOOL_RESULT_TOKENS });
            const fullText = `[Tool Result: ${inv.toolName}]\n${resultStr}`;
            parts.push(makePart(msg, i, 'tool-result', fullText, detail, inv.toolName));
          }
        }
      } else if (partType === 'tool-call') {
        const toolName = (part as any).toolName;
        if (toolName) {
          const rawArgs = (part as any).input ?? (part as any).args;
          const argsStr =
            detail === 'low' || rawArgs == null
              ? ''
              : `\n${typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs, null, 2)}`;
          const fullText = `[Tool Call: ${toolName}]${argsStr}`;
          parts.push({
            messageId: msg.id,
            partIndex: i,
            role: msg.role,
            type: 'tool-call',
            text: fullText,
            fullText,
            toolName,
          });
        }
      } else if (partType === 'tool-result') {
        const toolName = (part as any).toolName;
        if (toolName) {
          const rawResult = (part as any).output ?? (part as any).result;
          const resultStr = formatToolResultForObserver(rawResult, { maxTokens: HIGH_DETAIL_TOOL_RESULT_TOKENS });
          const fullText = `[Tool Result: ${toolName}]\n${resultStr}`;
          parts.push(makePart(msg, i, 'tool-result', fullText, detail, toolName));
        }
      } else if (partType === 'reasoning') {
        const reasoning = (part as { reasoning?: string; text?: string }).reasoning ?? (part as { text?: string }).text;
        if (reasoning) {
          parts.push(makePart(msg, i, 'reasoning', reasoning, detail));
        }
      } else if (partType === 'image' || partType === 'file') {
        const filename = (part as any).filename;
        const label = filename ? `: ${filename}` : '';
        const fullText = `[${partType === 'image' ? 'Image' : 'File'}${label}]`;
        parts.push({ messageId: msg.id, partIndex: i, role: msg.role, type: partType, text: fullText, fullText });
      } else if (partType?.startsWith('data-')) {
      } else if (partType) {
        const fullText = `[${partType}]`;
        parts.push({ messageId: msg.id, partIndex: i, role: msg.role, type: partType, text: fullText, fullText });
      }
    }
  } else if (msg.content?.content) {
    parts.push(makePart(msg, 0, 'text', msg.content.content, detail));
  }

  return parts;
}

export function buildRenderedText(parts: FormattedPart[], timestamps: Map<string, Date>): string {
  let currentMessageId = '';
  const lines: string[] = [];

  for (const part of parts) {
    if (part.messageId !== currentMessageId) {
      currentMessageId = part.messageId;
      const ts = timestamps.get(part.messageId);
      const tsStr = ts ? ` (${formatTimestamp(ts)})` : '';
      if (lines.length > 0) lines.push('');
      lines.push(`**${part.role}${tsStr}** [${part.messageId}]:`);
    }

    const indexLabel = `[p${part.partIndex}]`;
    lines.push(`  ${indexLabel} ${part.text}`);
  }

  return lines.join('\n');
}
