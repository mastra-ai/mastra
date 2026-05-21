import type { MastraDBMessage, MastraMessagePart, MessageSource } from '../state/types';

export function stampPart<T extends MastraMessagePart>(part: T, createdAt = Date.now()): T {
  if (part.createdAt == null) {
    part.createdAt = createdAt;
  }

  return part;
}

export function stampMessageParts<T extends MastraDBMessage>(message: T, source: MessageSource): T {
  if (source === 'memory' || !Array.isArray(message.content.parts)) {
    return message;
  }

  message.content.parts = message.content.parts.map(part => stampPart(part, message.createdAt.getTime()));
  return message;
}
