/**
 * Shared message-conversion helper used by both legacy `Harness` and v1
 * `Session.listMessages`.
 *
 * Spec §11.1 keeps `HarnessMessage` as a stable shared shape. This mapper is
 * intentionally pure so legacy and v1 can consume the same memory-storage row
 * shape without coupling to either runtime.
 */
import { createSignal, mastraDBMessageToSignal } from '../../agent/signals';
import type { AgentSignalContents } from '../../agent/signals';
import type { MastraDBMessage } from '../../agent/types';
import type { HarnessMessage, HarnessMessageContent } from '../types';

/**
 * Memory-storage row shape that both runtimes feed in. Storage adapters
 * serialize message parts as JSON, so the converter narrows each part by
 * `type` instead of assuming a concrete SDK message-part version.
 */
export interface StoredMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'signal';
  createdAt: Date;
  type?: string;
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

function signalContentsToHarnessContent(contents: AgentSignalContents): HarnessMessageContent[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  return contents.flatMap((part): HarnessMessageContent[] => {
    if (part.type === 'text') {
      return [{ type: 'text', text: part.text }];
    }
    if (typeof part.data !== 'string') return [];
    if (part.mediaType.startsWith('image/')) {
      return [{ type: 'image', data: part.data, mimeType: part.mediaType }];
    }
    return [
      {
        type: 'file',
        data: part.data,
        mediaType: part.mediaType,
        filename: part.filename,
      },
    ];
  });
}

function toSystemReminderContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'system_reminder' }> | undefined {
  const attributes = getRecordValue(payload.attributes);
  const metadata = getRecordValue(payload.metadata);
  const message = getStringValue(payload.contents);
  if (message === undefined) return undefined;

  return {
    type: 'system_reminder',
    message,
    reminderType:
      getStringValue(payload.reminderType) ?? getStringValue(attributes?.type) ?? getStringValue(payload.type),
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
  const rawContents = payload.contents;
  if (!id || rawContents === undefined) return undefined;

  const signal = createSignal({
    id,
    type: 'user-message',
    contents: rawContents as AgentSignalContents,
    createdAt: getStringValue(payload.createdAt),
  });
  const content = signalContentsToHarnessContent(signal.contents);
  if (content.length === 0) return undefined;

  return {
    id: signal.id,
    role: 'user',
    content,
    createdAt: signal.createdAt,
  };
}

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

  if (msg.role === 'signal') {
    const signal = mastraDBMessageToSignal(msg as MastraDBMessage);

    if (signal.type === 'user-message') {
      const signalContent = signalContentsToHarnessContent(signal.contents);
      if (signalContent.length > 0) {
        return {
          id: msg.id,
          role: 'user',
          content: signalContent,
          createdAt: msg.createdAt,
        };
      }
    }

    if (signal.type === 'system-reminder') {
      const reminder = toSystemReminderContent({
        type: signal.type,
        contents:
          typeof signal.contents === 'string'
            ? signal.contents
            : signal.contents
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map(part => part.text)
                .join('\n'),
        attributes: signal.attributes ?? msg.content.metadata,
        metadata: signal.metadata,
      });
      if (reminder) {
        content.push(reminder);
      }

      return {
        id: msg.id,
        role: 'user',
        content,
        createdAt: msg.createdAt,
      };
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
            const partProviderMetadata = part.providerMetadata;
            content.push({
              type: 'tool_result',
              id: inv.toolCallId,
              name: inv.toolName,
              result: inv.result,
              isError: inv.isError ?? false,
              ...(partProviderMetadata ? { providerMetadata: partProviderMetadata } : {}),
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
          const resultProviderMetadata = part.providerMetadata;
          content.push({
            type: 'tool_result',
            id: part.toolCallId,
            name: part.toolName,
            result: part.result,
            isError: part.isError ?? false,
            ...(resultProviderMetadata ? { providerMetadata: resultProviderMetadata } : {}),
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
      // Skip other part types (step-start, data-om-status, etc.).
    }
  }

  return { id: msg.id, role: msg.role === 'signal' ? 'user' : msg.role, content, createdAt: msg.createdAt };
}
