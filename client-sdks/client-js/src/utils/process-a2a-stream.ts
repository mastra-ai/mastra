import type { Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@mastra/core/a2a';
import { MastraClientError } from '../types';

export type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

type ParsedA2AEvent = { done: true; event?: never } | { done?: false; event?: A2AStreamEventData };

function splitNextEvent(buffer: string): { eventBlock?: string; rest: string } {
  const normalizedBuffer = buffer.replace(/\x1E/g, '\n\n');
  const match = normalizedBuffer.match(/\r?\n\r?\n/);

  if (!match || match.index === undefined) {
    return { rest: normalizedBuffer };
  }

  const separatorLength = match[0].length;
  return {
    eventBlock: normalizedBuffer.slice(0, match.index),
    rest: normalizedBuffer.slice(match.index + separatorLength),
  };
}

function parseEventBlock(eventBlock: string): ParsedA2AEvent {
  const trimmedBlock = eventBlock.trim();

  if (!trimmedBlock) {
    return {};
  }

  const lines = trimmedBlock.split(/\r?\n/);
  const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());

  const payload = dataLines.length > 0 ? dataLines.join('\n') : trimmedBlock;

  if (!payload || payload === '[DONE]') {
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
    return { event: parsed.result as A2AStreamEventData };
  }

  return { event: parsed as A2AStreamEventData };
}

export async function* processA2AStream(
  stream: globalThis.ReadableStream<Uint8Array>,
): AsyncGenerator<A2AStreamEventData, void, undefined> {
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

        if (!eventBlock) {
          break;
        }

        const parsedEvent = parseEventBlock(eventBlock);

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
      const parsedEvent = parseEventBlock(buffer);

      if (!parsedEvent.done && parsedEvent.event) {
        yield parsedEvent.event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
