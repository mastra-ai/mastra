import { createHash } from 'node:crypto';

/**
 * Create a hash of the input for deduplication.
 */
export function hashInput(input: unknown): string {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Create a hash of messages for deduplication.
 */
export function hashMessages(messages: Array<{ role: string; content: string }>): string {
  const content = messages.map(m => `${m.role}:${m.content}`).join('|');
  return hashInput(content);
}
