import type { MastraDBMessage } from '@mastra/core/agent/message-list';

export type SignalData = {
  id?: string;
  type?: string;
  tagName?: string;
  contents?: unknown;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

export type NotificationSignalMetadata = {
  signal?: 'notification' | 'summary';
  recordId?: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
  pending?: number;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const signalContentsToText = (contents: unknown): string => {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';

  return contents
    .flatMap(part => {
      if (!isRecord(part)) return [];
      return part.type === 'text' && typeof part.text === 'string' && part.text.length > 0 ? [part.text] : [];
    })
    .join('\n');
};

export const formatSignalValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

export const isSignalData = (value: unknown): value is SignalData => {
  if (!isRecord(value)) return false;
  return value.type === 'notification' || value.type === 'state' || value.type === 'reactive';
};

const getSignalMetadata = (message: MastraDBMessage): Record<string, unknown> | undefined => {
  const signal = message.content.metadata?.signal;
  return isRecord(signal) ? signal : undefined;
};

/**
 * Resolve the signal type for a persisted `role: 'signal'` message, mirroring
 * core's `getSignalType`. The type is stored under `content.metadata.signal.type`,
 * falling back to the top-level `message.type`.
 */
export const getSignalType = (message: MastraDBMessage): string | undefined => {
  const type = getSignalMetadata(message)?.type;
  return typeof type === 'string' ? type : message.type;
};

/**
 * User-message signals (the persisted echo of a user turn sent via `sendSignal`)
 * use `type: 'user'` or `'user-message'`. They render as a user message on
 * reload. Every other signal is a reactive/non-user signal that mirrors the
 * streaming accumulator's `data-signal` behavior: a signal badge folded onto an
 * assistant message.
 */
export const isUserSignalType = (type: string | undefined): boolean => type === 'user' || type === 'user-message';

const signalPartsToContents = (parts: MastraDBMessage['content']['parts']): unknown => {
  const contents: Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string }> = [];
  for (const rawPart of parts) {
    const part = rawPart as Record<string, unknown>;
    if (part.type === 'text' && typeof part.text === 'string') {
      contents.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.type === 'file' && typeof part.data === 'string') {
      const mediaType =
        (typeof part.mediaType === 'string' ? part.mediaType : undefined) ??
        (typeof part.mimeType === 'string' ? part.mimeType : undefined) ??
        'application/octet-stream';
      contents.push({ type: 'file', data: part.data, mediaType });
    }
  }
  return contents.length === 1 && contents[0]?.type === 'text' ? contents[0].text : contents;
};

/**
 * Build the `data-signal` payload for a persisted reactive signal row so the
 * existing `SignalBadge` can render it on read-back. Mirrors the 1.41.0
 * `to-assistant-ui-message` conversion that was lost when the chat renderer was
 * rewritten (PR #17774).
 */
export const toReactiveSignalData = (message: MastraDBMessage): SignalData => {
  const signal = getSignalMetadata(message) ?? {};
  return {
    id: typeof signal.id === 'string' ? signal.id : message.id,
    type: getSignalType(message),
    tagName: typeof signal.tagName === 'string' ? signal.tagName : message.type,
    contents: signalPartsToContents(message.content.parts),
    ...(isRecord(signal.attributes) ? { attributes: signal.attributes as SignalData['attributes'] } : {}),
    ...(isRecord(signal.metadata) ? { metadata: signal.metadata } : {}),
  };
};

export const getNotificationMetadata = (signal: SignalData): NotificationSignalMetadata | undefined => {
  const notification = isRecord(signal.metadata?.notification) ? signal.metadata.notification : undefined;
  if (!notification) return undefined;

  return {
    signal:
      notification.signal === 'notification' || notification.signal === 'summary' ? notification.signal : undefined,
    recordId: typeof notification.recordId === 'string' ? notification.recordId : undefined,
    source: typeof notification.source === 'string' ? notification.source : undefined,
    kind: typeof notification.kind === 'string' ? notification.kind : undefined,
    priority: typeof notification.priority === 'string' ? notification.priority : undefined,
    status: typeof notification.status === 'string' ? notification.status : undefined,
    pending: typeof notification.pending === 'number' ? notification.pending : undefined,
  };
};
