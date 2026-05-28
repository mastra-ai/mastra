import type { ThreadNotificationSignal, ThreadStateSignal } from '@/lib/ai-ui/thread-runtime-state';

type SignalDataPart = {
  type?: string;
  data?: {
    id?: string;
    type?: string;
    tagName?: string;
    contents?: unknown;
    createdAt?: string;
    attributes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};

const signalContentsPreview = (contents: unknown): string => {
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) {
    return contents
      .map(part => (typeof part === 'object' && part !== null && 'text' in part ? String(part.text) : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const getSignalParts = (messages: Array<{ parts?: unknown[] }>): SignalDataPart[] => {
  return messages.flatMap(message => {
    const parts = message.parts ?? [];
    return parts.filter(
      (part): part is SignalDataPart =>
        typeof part === 'object' && part !== null && typeof (part as SignalDataPart).type === 'string',
    );
  });
};

export const extractThreadSignalPanels = (messages: Array<{ parts?: unknown[] }>) => {
  const stateSignals: ThreadStateSignal[] = [];
  const notifications: ThreadNotificationSignal[] = [];

  for (const part of getSignalParts(messages)) {
    const category = part.data?.type;
    if (category === 'state') {
      const source =
        typeof part.data?.attributes?.type === 'string'
          ? part.data.attributes.type
          : typeof part.data?.attributes?.source === 'string'
            ? part.data.attributes.source
            : undefined;
      stateSignals.push({
        id: part.data?.id ?? `state-${stateSignals.length}`,
        title: source ? `${source} state` : 'State',
        preview: signalContentsPreview(part.data?.contents),
        source,
        updatedAt: part.data?.createdAt,
      });
    } else if (category === 'notification') {
      const attributes = part.data?.attributes ?? {};
      const metadata = part.data?.metadata ?? {};
      const notificationMetadata = metadata.notification as Record<string, unknown> | undefined;
      notifications.push({
        id: part.data?.id ?? `notification-${notifications.length}`,
        title: part.data?.tagName === 'notification-summary' ? 'Notification summary' : 'Notification',
        preview: signalContentsPreview(part.data?.contents),
        source:
          typeof attributes.source === 'string'
            ? attributes.source
            : typeof notificationMetadata?.source === 'string'
              ? notificationMetadata.source
              : undefined,
        priority: typeof attributes.priority === 'string' ? attributes.priority : undefined,
        status: typeof attributes.status === 'string' ? attributes.status : undefined,
        createdAt: part.data?.createdAt,
        count: typeof attributes.pending === 'number' ? attributes.pending : undefined,
      });
    }
  }

  return { stateSignals, notifications };
};

export const removePinnedSignalParts = <TMessage extends { role?: string; parts?: unknown[] }>(
  message: TMessage,
): TMessage | null => {
  const parts = message.parts?.filter(part => {
    const category = (part as SignalDataPart).data?.type;
    return category !== 'state' && category !== 'notification';
  });

  if (!parts || parts.length === (message.parts?.length ?? 0)) return message;
  if (parts.length === 0 && message.role === 'assistant') return null;
  return { ...message, parts };
};
