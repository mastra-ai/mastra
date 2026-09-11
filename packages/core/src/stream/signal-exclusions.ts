import type { AgentSignalCategory, AgentSignalType } from '../agent/signals';

function canonicalSignalType(type: unknown): AgentSignalCategory | undefined {
  switch (type) {
    case 'system-reminder':
      return 'reactive';
    case 'user-message':
      return 'user';
    case 'user':
    case 'state':
    case 'reactive':
    case 'notification':
      return type;
    default:
      return undefined;
  }
}

/** @internal Caller-local policy; never apply to shared buffers or model messages. */
export function isSignalChunkExcluded(
  chunk: unknown,
  hideSignals: boolean | readonly AgentSignalType[] | undefined,
): boolean {
  if (!hideSignals || !chunk || typeof chunk !== 'object') return false;
  if (!('type' in chunk) || (chunk.type !== 'data-signal' && chunk.type !== 'data-user-message')) return false;
  if (!('data' in chunk) || !chunk.data || typeof chunk.data !== 'object' || Array.isArray(chunk.data)) return false;
  if (!('type' in chunk.data)) return false;
  const type = canonicalSignalType(chunk.data.type);
  return (
    type !== undefined && (hideSignals === true || hideSignals.some(excluded => canonicalSignalType(excluded) === type))
  );
}
