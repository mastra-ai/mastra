import type { MastraDBMessage } from '@mastra/core/agent';
import { estimateTokenCount } from 'tokenx';

import { formatToolResultForObserver, resolveToolResultValue } from './tool-result-helpers';

// Ordinary captured windows peak at 10,511 characters / 2,649 estimated tokens.
export const HOOK_MESSAGE_MAX_CHARACTERS = 11 * 1024;
export const HOOK_MESSAGE_MAX_TOKENS = 3 * 1024;
const OMITTED = '\n... [middle context omitted] ...\n';

class HeadTailBuffer {
  private head = '';
  private tail = '';
  private length = 0;

  append(text: string) {
    this.length += text.length;
    const headRoom = HOOK_MESSAGE_MAX_CHARACTERS - this.head.length;
    if (headRoom > 0) this.head += text.slice(0, headRoom);
    this.tail =
      text.length >= HOOK_MESSAGE_MAX_CHARACTERS
        ? text.slice(-HOOK_MESSAGE_MAX_CHARACTERS)
        : (this.tail + text).slice(-HOOK_MESSAGE_MAX_CHARACTERS);
  }

  finish() {
    if (this.length <= HOOK_MESSAGE_MAX_CHARACTERS) return this.head;
    const headSize = Math.floor((HOOK_MESSAGE_MAX_CHARACTERS - OMITTED.length) / 2);
    return (
      this.head.slice(0, headSize) +
      OMITTED +
      this.tail.slice(-(HOOK_MESSAGE_MAX_CHARACTERS - OMITTED.length - headSize))
    );
  }
}

// Serialize incrementally: never allocate a JSON string or cloned object proportional
// to an arbitrarily large tool argument/result. Each string escape is bounded too.
function appendValue(buffer: HeadTailBuffer, value: unknown, ancestors = new Set<object>()) {
  if (typeof value === 'string') {
    buffer.append('"');
    for (let offset = 0; offset < value.length; offset += 256) {
      buffer.append(JSON.stringify(value.slice(offset, offset + 256)).slice(1, -1));
    }
    buffer.append('"');
  } else if (value === null || typeof value !== 'object') {
    buffer.append(typeof value === 'bigint' ? '"[bigint omitted]"' : (JSON.stringify(value) ?? 'null'));
  } else if (ancestors.has(value) || ancestors.size >= 64) {
    buffer.append('"[cyclic or deeply nested content omitted]"');
  } else {
    ancestors.add(value);
    const array = Array.isArray(value);
    buffer.append(array ? '[' : '{');
    let separator = '';
    if (array) {
      for (const item of value) {
        buffer.append(separator);
        appendValue(buffer, item, ancestors);
        separator = ',';
      }
    } else {
      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        const entry = (value as Record<string, unknown>)[key];
        if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol') continue;
        buffer.append(separator);
        appendValue(buffer, key, ancestors);
        buffer.append(':');
        if (key === 'encryptedContent' && typeof entry === 'string' && entry.length > 256) {
          buffer.append('"[encryptedContent omitted]"');
        } else {
          appendValue(buffer, entry, ancestors);
        }
        separator = ',';
      }
    }
    buffer.append(array ? ']' : '}');
    ancestors.delete(value);
  }
}

function boundedValue(value: unknown): string {
  const buffer = new HeadTailBuffer();
  if (typeof value === 'string') buffer.append(value);
  else appendValue(buffer, value);
  return buffer.finish();
}

function tokenBounded(text: string): string {
  if (estimateTokenCount(text) <= HOOK_MESSAGE_MAX_TOKENS) return text;
  let length = text.length;
  while (length > 0) {
    length = Math.floor(length / 2);
    const candidate =
      text.slice(0, Math.ceil(length / 2)) + OMITTED + (length > 1 ? text.slice(-Math.floor(length / 2)) : '');
    if (estimateTokenCount(candidate) <= HOOK_MESSAGE_MAX_TOKENS) return candidate;
  }
  return OMITTED;
}

/** A bounded observed window, not the parent's full live conversation. */
export function formatMessagesForExtractorHooks(messages: MastraDBMessage[]): string {
  const buffer = new HeadTailBuffer();
  for (const message of messages) {
    buffer.append('\n');
    buffer.append(message.role);
    buffer.append(':\n');
    const content = message.content;
    if (typeof content === 'string') {
      buffer.append(content);
      continue;
    }
    if (!content.parts?.length) {
      if (typeof content.content === 'string') buffer.append(content.content);
      continue;
    }
    for (const part of content.parts) {
      if (part.type === 'text') buffer.append(part.text);
      else if (part.type === 'reasoning') buffer.append(part.reasoning);
      else if (part.type === 'tool-invocation') {
        const invocation = part.toolInvocation;
        buffer.append(invocation.state === 'result' ? 'Tool Result ' : 'Tool Call ');
        buffer.append(invocation.toolName);
        buffer.append(': ');
        if (invocation.state === 'result') {
          const { value } = resolveToolResultValue(part, invocation.result);
          // Keep the existing tool-result token safeguard after bounded serialization.
          buffer.append(formatToolResultForObserver(boundedValue(value)));
        } else {
          buffer.append(boundedValue(invocation.args));
        }
      } else if (part.type === 'file') buffer.append('[file attachment]');
      buffer.append('\n');
    }
  }
  return tokenBounded(buffer.finish());
}
