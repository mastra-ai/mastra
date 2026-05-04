import type { CoreMessage } from '@internal/ai-sdk-v4';

import type { MessageListInput } from './message-list';
import type { MastraDBMessage } from './message-list/state/types';

export type AgentSignalType = 'user-message' | 'system-reminder' | string;

export interface AgentSignalInput {
  id?: string;
  type: AgentSignalType;
  contents: string;
  createdAt?: Date | string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
}

export type AgentSignalDataPart = {
  type: `data-${string}`;
  data: {
    id: string;
    type: AgentSignalType;
    contents: string;
    createdAt: string;
    attributes?: Record<string, string | number | boolean | null | undefined>;
    metadata?: Record<string, unknown>;
  };
};

export type CreatedAgentSignal = AgentSignalInput & {
  id: string;
  createdAt: Date;
  toDBMessage: (options?: { threadId?: string; resourceId?: string }) => MastraDBMessage;
  toLLMMessage: () => MessageListInput;
  toDataPart: () => AgentSignalDataPart;
};

export function isMastraSignalMessage(message: MastraDBMessage): message is MastraDBMessage & { role: 'signal' } {
  return message.role === 'signal';
}

function normalizeSignal(signal: AgentSignalInput | CreatedAgentSignal) {
  return {
    ...signal,
    id: signal.id ?? crypto.randomUUID(),
    createdAt:
      signal.createdAt instanceof Date ? signal.createdAt : signal.createdAt ? new Date(signal.createdAt) : new Date(),
  };
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeXmlAttribute(value: string): string {
  return escapeXml(value).replaceAll('"', '&quot;');
}

function signalAttributesToXml(attributes?: AgentSignalInput['attributes']): string {
  if (!attributes) {
    return '';
  }

  const serialized = Object.entries(attributes)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => `${key}="${escapeXmlAttribute(String(value))}"`)
    .join(' ');

  return serialized ? ` ${serialized}` : '';
}

export function signalToXmlMarkup(signal: Pick<AgentSignalInput, 'type' | 'contents' | 'attributes'>): string {
  return `<${signal.type}${signalAttributesToXml(signal.attributes)}>${escapeXml(signal.contents)}</${signal.type}>`;
}

function signalToLLMMessage(signal: Pick<AgentSignalInput, 'type' | 'contents' | 'attributes'>): MessageListInput {
  if (signal.type === 'user-message') {
    return signal.contents;
  }

  return [{ role: 'system', content: signalToXmlMarkup(signal) } as CoreMessage];
}

function signalToDataPart(signal: ReturnType<typeof normalizeSignal>): AgentSignalDataPart {
  return {
    type: `data-${signal.type}`,
    data: {
      id: signal.id,
      type: signal.type,
      contents: signal.contents,
      createdAt: signal.createdAt.toISOString(),
      ...(signal.attributes ? { attributes: signal.attributes } : {}),
      ...(signal.metadata ? { metadata: signal.metadata } : {}),
    },
  };
}

function signalToDBMessage(
  signal: ReturnType<typeof normalizeSignal>,
  options?: { threadId?: string; resourceId?: string },
): MastraDBMessage {
  return {
    id: signal.id,
    role: 'signal',
    createdAt: signal.createdAt,
    threadId: options?.threadId,
    resourceId: options?.resourceId,
    type: signal.type,
    content: {
      format: 2,
      content: signal.contents,
      parts: [{ type: 'text', text: signal.contents }],
      metadata: {
        ...(signal.attributes ?? {}),
        ...(signal.metadata ?? {}),
        signal: {
          id: signal.id,
          type: signal.type,
          createdAt: signal.createdAt.toISOString(),
          ...(signal.attributes ? { attributes: signal.attributes } : {}),
        },
      },
    },
  };
}

export function createSignal(input: AgentSignalInput): CreatedAgentSignal {
  const signal = normalizeSignal(input);

  return {
    ...signal,
    toDBMessage: options => signalToDBMessage(signal, options),
    toLLMMessage: () => signalToLLMMessage(signal),
    toDataPart: () => signalToDataPart(signal),
  };
}

export function signalToMessage(signal: AgentSignalInput | CreatedAgentSignal): MessageListInput {
  return createSignal(signal).toLLMMessage();
}

export function signalToMastraDBMessage(
  signal: AgentSignalInput | CreatedAgentSignal,
  options?: { threadId?: string; resourceId?: string },
): MastraDBMessage {
  return createSignal(signal).toDBMessage(options);
}

export function signalToDataPartFormat(signal: AgentSignalInput | CreatedAgentSignal): AgentSignalDataPart {
  return createSignal(signal).toDataPart();
}

export function mastraDBMessageToSignal(message: MastraDBMessage): CreatedAgentSignal {
  const metadataSignal = message.content.metadata?.signal;
  const signalMetadata =
    metadataSignal && typeof metadataSignal === 'object' && !Array.isArray(metadataSignal)
      ? (metadataSignal as Record<string, unknown>)
      : undefined;

  return createSignal({
    id: typeof signalMetadata?.id === 'string' ? signalMetadata.id : message.id,
    type: typeof signalMetadata?.type === 'string' ? signalMetadata.type : (message.type ?? 'user-message'),
    contents:
      typeof message.content.content === 'string'
        ? message.content.content
        : (message.content.parts.find(part => part.type === 'text')?.text ?? ''),
    createdAt: typeof signalMetadata?.createdAt === 'string' ? signalMetadata.createdAt : message.createdAt,
    attributes:
      signalMetadata?.attributes &&
      typeof signalMetadata.attributes === 'object' &&
      !Array.isArray(signalMetadata.attributes)
        ? (signalMetadata.attributes as AgentSignalInput['attributes'])
        : undefined,
    metadata: message.content.metadata,
  });
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  return createSignal(part.data);
}
