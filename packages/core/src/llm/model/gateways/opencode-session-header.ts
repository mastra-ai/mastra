import { randomUUID } from 'node:crypto';

/**
 * OpenCode Go requires a stable `x-opencode-session` header so it can route
 * and cache prompts. See https://opencode.ai/docs/go/#where-can-i-use-it
 */
const OPENCODE_SESSION_HEADER = 'x-opencode-session';
const THREAD_ID_HEADER = 'x-thread-id';

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

export function applyOpencodeSessionHeader(
  providerId: string,
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!providerId.startsWith('opencode')) {
    return headers;
  }

  const resolved = headers ?? {};
  if (getHeader(resolved, OPENCODE_SESSION_HEADER)) {
    return resolved;
  }

  return {
    ...resolved,
    [OPENCODE_SESSION_HEADER]: getHeader(resolved, THREAD_ID_HEADER) ?? randomUUID(),
  };
}
