import { MastraClientError } from '../types';

/**
 * A2A protocol v1 WIRE JSON shapes.
 *
 * `@a2a-js/sdk` v1 exports in-memory protobuf types (numeric enums,
 * `{ content: { $case } }` parts) that are NOT the JSON shapes that travel over
 * the wire, and it no longer exports the JSON-RPC event types from its root.
 * This client speaks HTTP/JSON-RPC directly, so the SSE stream carries these
 * wire JSON shapes: no `kind` discriminators, `role` is `'ROLE_USER' |
 * 'ROLE_AGENT'`, task `status.state` is a `'TASK_STATE_*'` string, and text
 * parts are `{ text }` (no `kind`).
 */

/** v1 wire task lifecycle state strings. */
export type A2ATaskState =
  | 'TASK_STATE_UNSPECIFIED'
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_REJECTED'
  | 'TASK_STATE_AUTH_REQUIRED';

/** v1 wire message role strings. */
export type A2ARole = 'ROLE_USER' | 'ROLE_AGENT';

/** A text part on the wire. */
export interface A2ATextPart {
  text: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A raw (base64-encoded) file part on the wire. */
export interface A2ARawFilePart {
  raw: string;
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A URL-referenced file part on the wire. */
export interface A2AUrlFilePart {
  url: string;
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A structured data part on the wire. */
export interface A2ADataPart {
  data: Record<string, unknown> | unknown[] | string | number | boolean | null;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export type A2APart = A2ATextPart | A2ARawFilePart | A2AUrlFilePart | A2ADataPart;

/** A message on the wire (no `kind`). */
export interface A2AMessage {
  messageId: string;
  role: A2ARole;
  parts: A2APart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

/** An artifact on the wire. */
export interface A2AArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts?: A2APart[];
  metadata?: Record<string, unknown>;
}

/** Task status container on the wire. */
export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

/** A task on the wire (no `kind`). */
export interface A2ATask {
  id: string;
  contextId: string;
  status: A2ATaskStatus;
  artifacts?: A2AArtifact[];
  history?: A2AMessage[];
  metadata?: Record<string, unknown>;
}

/** Status update stream event on the wire (no `kind` / `final`). */
export interface A2AStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: A2ATaskStatus;
  metadata?: Record<string, unknown>;
}

/** Artifact update stream event on the wire (no `kind`). */
export interface A2AArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: A2AArtifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

export type A2AStreamEventData = A2AMessage | A2ATask | A2AStatusUpdateEvent | A2AArtifactUpdateEvent;

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
