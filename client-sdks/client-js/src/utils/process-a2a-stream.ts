import type { Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@mastra/core/a2a/client';
import { MastraClientError } from '../types';

export type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

type ParsedA2AEvent<T> = { done: true; event?: never } | { done?: false; event?: T };

function splitNextEvent(buffer: string): { eventBlock?: string; rest: string } {
  const recordStart = buffer.startsWith('\x1E') ? 1 : 0;
  const match = /\r?\n\r?\n/.exec(buffer);
  const nextRecord = buffer.indexOf('\x1E', recordStart);

  if (nextRecord !== -1 && (!match || nextRecord < match.index)) {
    return { eventBlock: buffer.slice(0, nextRecord), rest: buffer.slice(nextRecord) };
  }
  if (!match) {
    return { rest: buffer };
  }

  return {
    eventBlock: buffer.slice(0, match.index),
    rest: buffer.slice(match.index + match[0].length),
  };
}

function parseEventBlock<T>(eventBlock: string, isSse: boolean): ParsedA2AEvent<T> {
  // Explicit JSON records take precedence. For legacy unframed JSON in SSE responses,
  // JSON-shaped blocks remain payloads; other data-less blocks are SSE metadata.
  const hasRecordSeparator = eventBlock.startsWith('\x1E');
  const trimmedBlock = (hasRecordSeparator ? eventBlock.slice(1) : eventBlock).trim();

  if (!trimmedBlock) {
    return {};
  }

  let payload = trimmedBlock;
  if (!hasRecordSeparator && !/^(?:[\[{"\d-]|(?:true|false|null)(?:\s|$))/.test(trimmedBlock)) {
    const lines = trimmedBlock.split(/\r?\n/);
    const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
    if (dataLines.length > 0) {
      payload = dataLines.join('\n').trim();
    } else if (
      isSse ||
      /^(?::|(?:event|id|retry|data)(?::|\r?\n|$))/.test(trimmedBlock) ||
      lines.every(line => /^(?::|[a-zA-Z][\w-]*:|(?:event|id|retry|data)$)/.test(line))
    ) {
      return {};
    }
  }
  if (!payload) {
    return {};
  }

  if (payload === '[DONE]') {
    return { done: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error(
      `Failed to parse A2A stream event: ${error instanceof Error ? error.message : 'unknown parse error'}`,
    );
  }

  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
    throw new MastraClientError(200, 'OK', `A2A stream error - ${JSON.stringify(parsed.error)}`, parsed.error);
  }

  if (parsed && typeof parsed === 'object' && 'result' in parsed) {
    return { event: parsed.result as T };
  }

  return { event: parsed as T };
}

export async function* processA2AStream<T = A2AStreamEventData>(
  stream: globalThis.ReadableStream<Uint8Array>,
  contentType?: string | null,
): AsyncGenerator<T, void, undefined> {
  const isSse = contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'text/event-stream';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      while (true) {
        const { eventBlock, rest } = splitNextEvent(buffer);
        buffer = rest;

        if (eventBlock === undefined) {
          break;
        }

        const parsedEvent = parseEventBlock<T>(eventBlock, isSse);

        if (parsedEvent.done) {
          return;
        }

        if (parsedEvent.event) {
          yield parsedEvent.event;
        }
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const parsedEvent = parseEventBlock<T>(buffer, isSse);

      if (!parsedEvent.done && parsedEvent.event) {
        yield parsedEvent.event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
