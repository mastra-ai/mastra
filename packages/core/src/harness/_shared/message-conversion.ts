/**
 * Shared message-conversion helper used by both legacy `Harness` and v1
 * `Session.listMessages`. Spec §11.1 explicitly endorses sharing stable
 * interfaces (`HarnessMessage`, `HarnessMessageContent`) across the two
 * runtimes; this module is the canonical mapper from Mastra memory storage
 * shape into the UI-facing `HarnessMessage` partition.
 *
 * No `this`-coupling, no harness state — pure function over an input row.
 */
import { mastraDBMessageToSignal } from '../../agent/signals';
import type { MastraDBMessage } from '../../agent/types';
import type { HarnessMessage, HarnessMessageContent } from '../types';

/**
 * Memory-storage row shape that both runtimes feed in. We type the parts
 * loosely because storage backends serialise these as JSON; the converter
 * is responsible for narrowing each part by `type`.
 */
export interface StoredMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'signal';
  createdAt: Date;
  content: {
    content?: string;
    parts: Array<{
      type: string;
      text?: string;
      reasoning?: string;
      toolCallId?: string;
      toolName?: string;
      args?: unknown;
      result?: unknown;
      isError?: boolean;
      data?: unknown;
      providerMetadata?: Record<string, unknown>;
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

function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getRecordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function signalContentsToHarnessContent(contents: unknown): HarnessMessageContent[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  if (Array.isArray(contents)) return contents.flatMap(signalContentsToHarnessContent);
  if (!contents || typeof contents !== 'object') return [];

  const content = (contents as { content?: unknown }).content;
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) {
    return content.flatMap((part): HarnessMessageContent[] => {
      const record = getRecordValue(part);
      if (!record) return [];
      if (record.type === 'text' && typeof record.text === 'string') {
        return [{ type: 'text', text: record.text }];
      }
      if (record.type === 'file' && typeof record.data === 'string' && typeof record.mediaType === 'string') {
        if (record.mediaType.startsWith('image/')) {
          return [{ type: 'image', data: record.data, mimeType: record.mediaType }];
        }
        return [
          {
            type: 'file',
            data: record.data,
            mediaType: record.mediaType,
            filename: typeof record.filename === 'string' ? record.filename : undefined,
          },
        ];
      }
      return [];
    });
  }

  return [];
}

function toSystemReminderContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'system_reminder' }> | undefined {
  const attributes = getRecordValue(payload.attributes);
  const metadata = getRecordValue(payload.metadata);
  const message = getStringValue(payload.contents) ?? getStringValue(payload.message);
  if (message === undefined) return undefined;

  return {
    type: 'system_reminder',
    message,
    reminderType:
      getStringValue(payload.reminderType) ??
      getStringValue(attributes?.reminderType) ??
      getStringValue(attributes?.type) ??
      getStringValue(metadata?.reminderType) ??
      getStringValue(payload.type),
    path: getStringValue(payload.path) ?? getStringValue(attributes?.path),
    precedesMessageId: getStringValue(payload.precedesMessageId) ?? getStringValue(attributes?.precedesMessageId),
    gapText: getStringValue(payload.gapText) ?? getStringValue(attributes?.gapText),
    gapMs:
      typeof payload.gapMs === 'number'
        ? payload.gapMs
        : typeof attributes?.gapMs === 'number'
          ? attributes.gapMs
          : undefined,
    timestamp: getStringValue(payload.timestamp) ?? getStringValue(attributes?.timestamp),
    goalMaxTurns:
      typeof payload.goalMaxTurns === 'number'
        ? payload.goalMaxTurns
        : typeof metadata?.goalMaxTurns === 'number'
          ? metadata.goalMaxTurns
          : undefined,
    judgeModelId: getStringValue(payload.judgeModelId) ?? getStringValue(metadata?.judgeModelId),
  };
}

function toUserSignalMessage(payload: Record<string, unknown>): HarnessMessage | undefined {
  const id = getStringValue(payload.id);
  const contents = payload.contents ?? payload.message;
  if (!id || contents === undefined) return undefined;

  const content = signalContentsToHarnessContent(contents);
  if (content.length === 0) return undefined;

  return {
    id,
    role: 'user',
    content,
    createdAt: new Date(getStringValue(payload.createdAt) ?? Date.now()),
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
  const systemReminder = getRecordValue(msg.content.metadata?.systemReminder);

  if (systemReminder && typeof systemReminder.type === 'string') {
    const reminder = toSystemReminderContent({
      ...systemReminder,
      contents: typeof systemReminder.message === 'string' ? systemReminder.message : '',
      reminderType: systemReminder.type,
    });
    if (reminder) {
      content.push(reminder);
    }

    return { id: msg.id, role: msg.role === 'signal' ? 'user' : msg.role, content, createdAt: msg.createdAt };
  }

  const signalMetadata = getRecordValue(msg.content.metadata?.signal);
  if (signalMetadata?.type === 'user-message') {
    const signalContent = signalContentsToHarnessContent(signalMetadata.contents ?? msg.content.content);
    if (signalContent.length > 0) {
      return { id: msg.id, role: 'user', content: signalContent, createdAt: msg.createdAt };
    }
  }

  if (signalMetadata?.type === 'system-reminder') {
    const reminder = toSystemReminderContent({
      type: signalMetadata.type,
      contents: signalMetadata.contents ?? msg.content.content,
      attributes: getRecordValue(signalMetadata.attributes) ?? msg.content.metadata,
      metadata: getRecordValue(signalMetadata.metadata),
    });
    if (reminder) {
      content.push(reminder);
      return { id: msg.id, role: 'user', content, createdAt: msg.createdAt };
    }
  }

  if (msg.role === 'signal') {
    const signal = mastraDBMessageToSignal(msg as MastraDBMessage);

    if (signal.type === 'user-message') {
      const signalContent = signalContentsToHarnessContent(signal.contents);
      if (signalContent.length > 0) {
        return { id: msg.id, role: 'user', content: signalContent, createdAt: msg.createdAt };
      }
    }

    if (signal.type === 'system-reminder') {
      // `msg.role === 'signal'` rows parsed through `mastraDBMessageToSignal`
      // must not fall through to the parts loop; return a user message even
      // when `toSystemReminderContent` cannot build a reminder payload.
      const reminder = toSystemReminderContent({
        type: signal.type,
        contents: signal.contents,
        attributes: signal.attributes ?? msg.content.metadata,
        metadata: signal.metadata,
      });
      if (reminder) {
        content.push(reminder);
      }

      return { id: msg.id, role: 'user', content, createdAt: msg.createdAt };
    }
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
          if (inv.state === 'result') {
            content.push({
              type: 'tool_result',
              id: inv.toolCallId,
              name: inv.toolName,
              result: inv.result,
              isError: inv.isError ?? false,
              ...(part.providerMetadata ? { providerMetadata: part.providerMetadata } : {}),
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
            ...(part.providerMetadata ? { providerMetadata: part.providerMetadata } : {}),
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
      case 'data-user-message': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        const message = toUserSignalMessage(data);
        if (message) {
          content.push(...message.content);
        }
        break;
      }
      case 'data-system-reminder': {
        const data = (part as { data?: Record<string, unknown> }).data ?? {};
        const reminder = toSystemReminderContent(data);
        if (reminder) {
          content.push(reminder);
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

  return { id: msg.id, role: msg.role === 'signal' ? 'user' : msg.role, content, createdAt: msg.createdAt };
}
