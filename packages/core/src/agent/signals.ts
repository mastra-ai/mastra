import type { CoreMessage } from '@internal/ai-sdk-v4';

import type { MessageListInput } from './message-list';
import type { MastraDBMessage } from './message-list/state/types';

export type AgentSignalType = 'user-message' | 'system-reminder' | string;

export type AgentSignalContents = MessageListInput;

type AgentSignalInputBase = {
  id?: string;
  createdAt?: Date | string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

export type UserMessageAgentSignalInput = AgentSignalInputBase & {
  type: 'user-message';
  contents: AgentSignalContents;
};

export type ContextAgentSignalInput = AgentSignalInputBase & {
  type: Exclude<AgentSignalType, 'user-message'>;
  contents: string;
};

export type AgentSignalInput = UserMessageAgentSignalInput | ContextAgentSignalInput;

export type AgentSignalDataPart = {
  type: `data-${string}`;
  data: {
    id: string;
    type: AgentSignalType;
    contents: AgentSignalContents;
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
  return `<${signal.type}${signalAttributesToXml(signal.attributes)}>${escapeXml(signalContentsToText(signal.contents))}</${signal.type}>`;
}

function signalContentsToText(contents: AgentSignalContents): string {
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) {
    return contents.map(content => signalContentsToText(content as AgentSignalContents)).join('\n');
  }
  if (contents && typeof contents === 'object') {
    const content = (contents as { content?: unknown }).content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map(part =>
          part && typeof part === 'object' && 'text' in part ? String((part as { text: unknown }).text) : '',
        )
        .filter(Boolean)
        .join('\n');
    }
  }
  return '';
}

function signalToLLMMessage(signal: Pick<AgentSignalInput, 'type' | 'contents' | 'attributes'>): MessageListInput {
  if (signal.type === 'user-message') {
    return signal.contents;
  }

  return [
    {
      // user role for system messages because "system" role can not in any provider go contextually within conversation history, which is what signals need to do. Not assistant role because then the assistant will think it was the one who said that. User role is the only appropriate role. We wrap in xml tags to make it clearer to the LLM that this is system added context.
      role: 'user',
      content: signalToXmlMarkup({ ...signal, contents: signalContentsToText(signal.contents) }),
    } as CoreMessage,
  ];
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
      content: signalContentsToText(signal.contents),
      parts: [{ type: 'text', text: signalContentsToText(signal.contents) }],
      metadata: {
        ...(signal.attributes ?? {}),
        ...(signal.metadata ?? {}),
        signal: {
          id: signal.id,
          type: signal.type,
          createdAt: signal.createdAt.toISOString(),
          contents: signal.contents,
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

  const type = typeof signalMetadata?.type === 'string' ? signalMetadata.type : (message.type ?? 'user-message');
  const contents =
    signalMetadata && 'contents' in signalMetadata
      ? (signalMetadata.contents as AgentSignalContents)
      : typeof message.content.content === 'string'
        ? message.content.content
        : (message.content.parts.find(part => part.type === 'text')?.text ?? '');
  const base = {
    id: typeof signalMetadata?.id === 'string' ? signalMetadata.id : message.id,
    createdAt: typeof signalMetadata?.createdAt === 'string' ? signalMetadata.createdAt : message.createdAt,
    attributes:
      signalMetadata?.attributes &&
      typeof signalMetadata.attributes === 'object' &&
      !Array.isArray(signalMetadata.attributes)
        ? (signalMetadata.attributes as AgentSignalInput['attributes'])
        : undefined,
    metadata: message.content.metadata,
  };

  return createSignal(
    type === 'user-message' ? { ...base, type, contents } : { ...base, type, contents: signalContentsToText(contents) },
  );
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  return createSignal(
    part.data.type === 'user-message'
      ? { ...part.data, type: 'user-message' }
      : { ...part.data, contents: signalContentsToText(part.data.contents) },
  );
}
