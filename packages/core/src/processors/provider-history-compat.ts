import { APICallError } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../agent/message-list';
import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

/**
 * Pattern that valid tool-call IDs must match.
 * Providers like Anthropic enforce `^[a-zA-Z0-9_-]+$`.
 */
const VALID_TOOL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Error patterns that indicate a tool-call ID validation failure.
 * Different providers surface this in slightly different wording.
 */
const TOOL_ID_ERROR_PATTERNS = [/tool_use\.id:.*should match pattern/i, /tool_call_id.*invalid/i];

function getErrorCandidates(error: APICallError | Error): string[] {
  const candidates = [error.message];

  if (APICallError.isInstance(error) && typeof error.responseBody === 'string') {
    candidates.push(error.responseBody);
  }

  return candidates.filter(Boolean);
}

/**
 * Checks whether an error is a tool-call ID validation failure.
 */
function isToolIdError(error: unknown): boolean {
  const matchesKnownPattern = (message: string) => TOOL_ID_ERROR_PATTERNS.some(pattern => pattern.test(message));

  if (APICallError.isInstance(error)) {
    return getErrorCandidates(error).some(matchesKnownPattern);
  }

  if (error instanceof Error) {
    return getErrorCandidates(error).some(matchesKnownPattern);
  }

  return false;
}

/**
 * Replace characters that don't match `[a-zA-Z0-9_-]` with an underscore.
 */
function sanitizeToolId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Build a mapping of invalid tool-call IDs to sanitized replacements
 * by scanning all messages.
 */
function buildToolIdMap(messages: MastraDBMessage[]): Map<string, string> {
  const idMap = new Map<string, string>();

  for (const msg of messages) {
    if (!msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part.type === 'tool-invocation') {
        const id = part.toolInvocation.toolCallId;
        if (id && !VALID_TOOL_ID_PATTERN.test(id) && !idMap.has(id)) {
          idMap.set(id, sanitizeToolId(id));
        }
      }
    }

    // Also check legacy toolInvocations array
    if (msg.content.toolInvocations) {
      for (const inv of msg.content.toolInvocations) {
        const id = inv.toolCallId;
        if (id && !VALID_TOOL_ID_PATTERN.test(id) && !idMap.has(id)) {
          idMap.set(id, sanitizeToolId(id));
        }
      }
    }
  }

  return idMap;
}

/**
 * Rewrite tool-call IDs in all messages using the provided mapping.
 * Mutates messages in place.
 */
function rewriteToolIds(messages: MastraDBMessage[], idMap: Map<string, string>): void {
  for (const msg of messages) {
    if (msg.content?.parts) {
      for (let i = 0; i < msg.content.parts.length; i++) {
        const part = msg.content.parts[i] as MastraMessagePart;
        if (part.type === 'tool-invocation') {
          const oldId = part.toolInvocation.toolCallId;
          const newId = idMap.get(oldId);
          if (newId) {
            (part as MastraToolInvocationPart).toolInvocation = {
              ...part.toolInvocation,
              toolCallId: newId,
            };
          }
        }
      }
    }

    // Also rewrite legacy toolInvocations array
    if (msg.content?.toolInvocations) {
      for (const inv of msg.content.toolInvocations) {
        const newId = idMap.get(inv.toolCallId);
        if (newId) {
          inv.toolCallId = newId;
        }
      }
    }
  }
}

/**
 * Handles tool-call ID validation errors that occur when switching between
 * LLM providers. Different providers generate tool-call IDs in different
 * formats, and some providers (e.g. Anthropic) enforce a strict pattern
 * (`^[a-zA-Z0-9_-]+$`). When history from one provider contains IDs that
 * violate another provider's rules, this processor rewrites those IDs and
 * retries the request.
 */
export class ProviderHistoryCompat implements Processor<'provider-history-compat'> {
  readonly id = 'provider-history-compat' as const;
  readonly name = 'Provider History Compat';

  async processAPIError({
    error,
    messageList,
    retryCount,
  }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount > 0) return;

    if (!isToolIdError(error)) return;

    const messages = messageList.get.all.db();
    const idMap = buildToolIdMap(messages);

    if (idMap.size === 0) return;

    rewriteToolIds(messages, idMap);

    return { retry: true };
  }
}
