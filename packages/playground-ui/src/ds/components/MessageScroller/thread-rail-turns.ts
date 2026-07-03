import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { CLIENT_MESSAGE_ID_KEY } from '@mastra/react';

const SUMMARY_MAX_LENGTH = 120;
const FILE_PREVIEW_LIMIT = 2;

export interface ThreadRailTurn {
  key: string;
  messageId: string;
  prompt: string;
  reply?: string;
  files: string[];
  hiddenFileCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getClientMessageKey = (message: MastraDBMessage): string => {
  const metadata = message.content.metadata;
  const clientMessageId = isRecord(metadata) ? metadata[CLIENT_MESSAGE_ID_KEY] : undefined;
  return typeof clientMessageId === 'string' && clientMessageId.length > 0 ? clientMessageId : message.id;
};

const normalizeSummary = (value: string, fallback: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return fallback;
  if (normalized.length <= SUMMARY_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, SUMMARY_MAX_LENGTH - 3).trimEnd()}...`;
};

const getTextFromParts = (message: MastraDBMessage): string =>
  message.content.parts
    .flatMap(part => {
      if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') return [];
      return [part.text];
    })
    .join('\n');

const getStringField = (part: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = part[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
};

const getPathLabel = (value: string): string | undefined => {
  if (value.startsWith('data:')) return undefined;

  try {
    const url = new URL(value);
    const candidate = url.pathname.split('/').filter(Boolean).pop();
    return candidate || url.hostname || undefined;
  } catch {
    const candidate = value.split(/[?#]/)[0]?.split('/').filter(Boolean).pop();
    return candidate && !candidate.startsWith('data:') ? candidate : undefined;
  }
};

const getFallbackFileLabel = (part: Record<string, unknown>): string => {
  const mediaType = getStringField(part, ['mimeType', 'mediaType']) ?? '';
  if (part.type === 'image' || mediaType.startsWith('image/')) return 'Image';
  if (mediaType === 'application/pdf') return 'PDF';
  if (mediaType.startsWith('video/')) return 'Video';
  if (mediaType.startsWith('audio/')) return 'Audio';
  return 'File';
};

const getFileLabelFromPart = (part: MastraDBMessage['content']['parts'][number]): string | undefined => {
  if (!isRecord(part)) return undefined;

  const type = getStringField(part, ['type']);
  if (type !== 'file' && type !== 'image') return undefined;

  const explicitLabel = getStringField(part, ['filename', 'name']);
  if (explicitLabel) return explicitLabel;

  const source = getStringField(part, ['url', 'image', 'data']);
  const pathLabel = source ? getPathLabel(source) : undefined;
  return pathLabel ?? getFallbackFileLabel(part);
};

const getFileLabels = (message: MastraDBMessage): string[] =>
  message.content.parts.map(getFileLabelFromPart).filter((label): label is string => Boolean(label));

const getSignalType = (message: MastraDBMessage): string | undefined => {
  const signal = message.content.metadata?.signal;
  const metadataType = isRecord(signal) ? signal.type : undefined;
  return typeof metadataType === 'string' ? metadataType : message.type;
};

const isDisplayableUserMessage = (message: MastraDBMessage): boolean => {
  if (message.role === 'user') return true;
  if (message.role !== 'signal') return false;

  const signalType = getSignalType(message);
  return signalType === 'user' || signalType === 'user-message';
};

const getNextAssistantReply = (messages: MastraDBMessage[], startIndex: number): string | undefined => {
  for (let index = startIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) continue;
    if (isDisplayableUserMessage(message)) return undefined;
    if (message.role !== 'assistant') continue;

    const reply = normalizeSummary(getTextFromParts(message), '');
    if (reply) return reply;
  }

  return undefined;
};

export const buildThreadRailTurns = (messages: MastraDBMessage[]): ThreadRailTurn[] =>
  messages.flatMap((message, index) => {
    if (!isDisplayableUserMessage(message)) return [];

    const files = getFileLabels(message);
    const visibleFiles = files.slice(0, FILE_PREVIEW_LIMIT);

    return [
      {
        key: getClientMessageKey(message),
        messageId: message.id,
        prompt: normalizeSummary(getTextFromParts(message), files.length > 0 ? 'Attached file' : 'User message'),
        reply: getNextAssistantReply(messages, index),
        files: visibleFiles,
        hiddenFileCount: files.length - visibleFiles.length,
      },
    ];
  });
