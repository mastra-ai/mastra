/**
 * Shared message-conversion helper used by both legacy `Harness` and v1
 * `Session.listMessages`. Spec §11.1 explicitly endorses sharing stable
 * interfaces (`HarnessMessage`, `HarnessMessageContent`) across the two
 * runtimes; this module is the canonical mapper from Mastra memory storage
 * shape into the UI-facing `HarnessMessage` partition.
 *
 * No `this`-coupling, no harness state — pure function over an input row.
 */
import type { HarnessMessage, HarnessMessageContent } from '../types';

/**
 * Memory-storage row shape that both runtimes feed in. We type the parts
 * loosely because storage backends serialise these as JSON; the converter
 * is responsible for narrowing each part by `type`.
 */
export interface StoredMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  content: {
    parts: Array<{
      type: string;
      text?: string;
      reasoning?: string;
      toolCallId?: string;
      toolName?: string;
      args?: unknown;
      result?: unknown;
      isError?: boolean;
      toolInvocation?: {
        state: string;
        toolCallId: string;
        toolName: string;
        args?: unknown;
        result?: unknown;
        isError?: boolean;
      };
      [key: string]: unknown;
    }>;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Convert a stored message row into the public `HarnessMessage` partition.
 *
 * - System-reminder messages (carried on `content.metadata.systemReminder`)
 *   collapse into a single `system_reminder` content part — these are
 *   harness-injected reminders, not actual model output, so the rest of the
 *   parts array is dropped.
 * - Tool invocations split into `tool_call` + (optional) `tool_result`
 *   pairs so the renderer can interleave them with text/thinking content.
 * - OM (`om_*`) and harness-injected data parts pass through with their
 *   payloads narrowed.
 * - Unknown part types are dropped silently — this keeps forward-compat
 *   with new storage shapes.
 */
export function convertStoredMessageToHarnessMessage(msg: StoredMessageRow): HarnessMessage {
  const content: HarnessMessageContent[] = [];
  const systemReminder =
    typeof msg.content.metadata?.systemReminder === 'object' && msg.content.metadata.systemReminder !== null
      ? msg.content.metadata.systemReminder
      : undefined;

  if (systemReminder && 'type' in systemReminder && typeof systemReminder.type === 'string') {
    content.push({
      type: 'system_reminder',
      message: 'message' in systemReminder && typeof systemReminder.message === 'string' ? systemReminder.message : '',
      reminderType: systemReminder.type,
      path: 'path' in systemReminder && typeof systemReminder.path === 'string' ? systemReminder.path : undefined,
      precedesMessageId:
        'precedesMessageId' in systemReminder && typeof systemReminder.precedesMessageId === 'string'
          ? systemReminder.precedesMessageId
          : undefined,
      gapText:
        'gapText' in systemReminder && typeof systemReminder.gapText === 'string' ? systemReminder.gapText : undefined,
      gapMs: 'gapMs' in systemReminder && typeof systemReminder.gapMs === 'number' ? systemReminder.gapMs : undefined,
      timestamp:
        'timestamp' in systemReminder && typeof systemReminder.timestamp === 'string'
          ? systemReminder.timestamp
          : undefined,
    });

    return { id: msg.id, role: msg.role, content, createdAt: msg.createdAt };
  }

  for (const part of msg.content.parts) {
    switch (part.type) {
      case 'text':
        if (part.text) {
          content.push({ type: 'text', text: part.text });
        }
        break;
      case 'reasoning':
        if (part.reasoning) {
          content.push({ type: 'thinking', thinking: part.reasoning });
        }
        break;
      case 'tool-invocation':
        if (part.toolInvocation) {
          const inv = part.toolInvocation;
          content.push({ type: 'tool_call', id: inv.toolCallId, name: inv.toolName, args: inv.args });
          if (inv.state === 'result' && inv.result !== undefined) {
            content.push({
              type: 'tool_result',
              id: inv.toolCallId,
              name: inv.toolName,
              result: inv.result,
              isError: inv.isError ?? false,
            });
          }
        } else if (part.toolCallId && part.toolName) {
          content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
        }
        break;
      case 'tool-call':
        if (part.toolCallId && part.toolName) {
          content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
        }
        break;
      case 'tool-result':
        if (part.toolCallId && part.toolName) {
          content.push({
            type: 'tool_result',
            id: part.toolCallId,
            name: part.toolName,
            result: part.result,
            isError: part.isError ?? false,
          });
        }
        break;
      case 'data-om-observation-start': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        content.push({
          type: 'om_observation_start',
          tokensToObserve: (data.tokensToObserve as number) ?? 0,
          operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
        });
        break;
      }
      case 'data-om-observation-end': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        content.push({
          type: 'om_observation_end',
          tokensObserved: (data.tokensObserved as number) ?? 0,
          observationTokens: (data.observationTokens as number) ?? 0,
          durationMs: (data.durationMs as number) ?? 0,
          operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
          observations: (data.observations as string) ?? undefined,
          currentTask: (data.currentTask as string) ?? undefined,
          suggestedResponse: (data.suggestedResponse as string) ?? undefined,
        });
        break;
      }
      case 'data-om-observation-failed': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        content.push({
          type: 'om_observation_failed',
          error: (data.error as string) ?? 'Unknown error',
          tokensAttempted: (data.tokensAttempted as number) ?? 0,
          operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
        });
        break;
      }
      case 'data-system-reminder': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        const message = data.message;
        if (typeof message === 'string') {
          content.push({
            type: 'system_reminder',
            message,
            reminderType: typeof data.reminderType === 'string' ? data.reminderType : undefined,
            path: typeof data.path === 'string' ? data.path : undefined,
            precedesMessageId: typeof data.precedesMessageId === 'string' ? data.precedesMessageId : undefined,
            gapText: typeof data.gapText === 'string' ? data.gapText : undefined,
            gapMs: typeof data.gapMs === 'number' ? data.gapMs : undefined,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp : undefined,
          });
        }
        break;
      }
      case 'file':
        if (typeof part.data !== 'string') {
          console.warn('[Harness] Skipping file part with non-string data:', typeof part.data);
          break;
        }
        content.push({
          type: 'file',
          data: part.data,
          mediaType:
            (part as { mediaType?: string }).mediaType ??
            (part as { mimeType?: string }).mimeType ??
            'application/octet-stream',
          ...((part as { filename?: string }).filename ? { filename: (part as { filename?: string }).filename } : {}),
        });
        break;
      case 'image': {
        const imgData =
          typeof part.data === 'string'
            ? part.data
            : typeof (part as { image?: string }).image === 'string'
              ? (part as { image?: string }).image!
              : '';
        content.push({
          type: 'image',
          data: imgData,
          mimeType:
            (part as { mimeType?: string }).mimeType ?? (part as { mediaType?: string }).mediaType ?? 'image/png',
        });
        break;
      }
      case 'data-om-thread-update': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        if (data.newTitle) {
          content.push({
            type: 'om_thread_title_updated',
            threadId: (data.threadId as string) ?? '',
            oldTitle: (data.oldTitle as string) ?? undefined,
            newTitle: data.newTitle as string,
          });
        }
        break;
      }
      // Skip other part types (step-start, data-om-status, etc.)
    }
  }

  return { id: msg.id, role: msg.role, content, createdAt: msg.createdAt };
}
