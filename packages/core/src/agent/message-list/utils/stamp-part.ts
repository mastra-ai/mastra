import type { MastraDBMessage, MastraMessagePart, MessageSource } from '../state/types';

let lastPartCreatedAt = 0;

export function stampPart<T extends MastraMessagePart>(part: T): T {
  if (part.createdAt == null) {
    lastPartCreatedAt = Math.max(Date.now(), lastPartCreatedAt + 1);
    part.createdAt = lastPartCreatedAt;
  } else {
    const createdAt = Number(part.createdAt);
    if (Number.isFinite(createdAt)) lastPartCreatedAt = Math.max(lastPartCreatedAt, createdAt);
  }

  return part;
}

export function stampMessageParts<T extends MastraDBMessage>(message: T, source: MessageSource): T {
  if (source === 'memory' || !Array.isArray(message.content.parts)) {
    return message;
  }

  message.content.parts = message.content.parts.map(part => stampPart(part));
  return message;
}

type ToolInvocationPart = Extract<MastraMessagePart, { type: 'tool-invocation' }>;

/**
 * Stamps `updatedAt` on a tool part whose invocation changed. A merge that
 * repeats the same state keeps its stamp, so replay dedupe doesn't drop newer parts.
 */
export function stampToolPartUpdate(
  part: ToolInvocationPart,
  before: ToolInvocationPart['toolInvocation'],
  incomingUpdatedAt?: number,
): void {
  if (incomingUpdatedAt !== undefined) {
    part.updatedAt = incomingUpdatedAt;
    return;
  }
  if (part.updatedAt !== undefined && JSON.stringify(before) === JSON.stringify(part.toolInvocation)) return;
  part.updatedAt = Date.now();
}
