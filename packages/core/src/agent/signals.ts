import type { CoreMessage } from '@internal/ai-sdk-v4';

import type { BaseMessageListInput } from './message-list';
import type { MastraDBMessage, MastraMessagePart } from './message-list/state/types';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalType = 'user-message' | 'system-reminder' | string;

/**
 * Text part of a signal's contents.
 */
export type AgentSignalTextPart = {
  type: 'text';
  text: string;
};

/**
 * File/image part of a signal's contents. Uses AI SDK v5 naming
 * (`mediaType`) so signal call sites can construct parts without
 * translating between SDK versions. `data` is a string (base64-encoded
 * payload or URL) to keep the part round-trippable through DB storage
 * and UI rendering without re-encoding.
 */
export type AgentSignalFilePart = {
  type: 'file';
  data: string;
  mediaType: string;
  filename?: string;
};

/**
 * Canonical input shape for `signal.contents`. Signals represent a single user
 * turn, so the contents are either a plain text string or a parts array of
 * text + file/image parts. Anything richer (tool calls, reasoning, multiple
 * turns) is not a signal and should go through the agent stream directly.
 */
export type AgentSignalContents = string | Array<AgentSignalTextPart | AgentSignalFilePart>;

type AgentSignalInputBase = {
  id?: string;
  createdAt?: Date | string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type UserMessageAgentSignalInput = AgentSignalInputBase & {
  type: 'user-message';
  contents: AgentSignalContents;
};

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type ContextAgentSignalInput = AgentSignalInputBase & {
  type: Exclude<AgentSignalType, 'user-message'>;
  contents: AgentSignalContents;
};

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalInput = UserMessageAgentSignalInput | ContextAgentSignalInput;

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
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

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type CreatedAgentSignal = AgentSignalInput & {
  __isCreatedSignal: true;
  id: string;
  createdAt: Date;
  toDBMessage: (options?: { threadId?: string; resourceId?: string }) => MastraDBMessage;
  toLLMMessage: () => BaseMessageListInput;
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

const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function assertXmlName(name: string, label: string): void {
  if (!XML_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid signal XML ${label}: ${name}`);
  }
}

function signalAttributesToXml(attributes?: AgentSignalInput['attributes']): string {
  if (!attributes) {
    return '';
  }

  const serialized = Object.entries(attributes)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => {
      assertXmlName(key, 'attribute name');
      return `${key}="${escapeXmlAttribute(String(value))}"`;
    })
    .join(' ');

  return serialized ? ` ${serialized}` : '';
}

// Render a text-only signal as a single XML element string. For multimodal contents
// (file/image parts) use signalToLLMMessage which preserves attachments. This helper exists
// for callers that already have a flat string and want the canonical XML wrapping.
export function signalToXmlMarkup(signal: {
  type: AgentSignalInput['type'];
  contents?: string;
  attributes?: AgentSignalInput['attributes'];
}): string {
  assertXmlName(signal.type, 'tag name');
  const attributesXml = signalAttributesToXml(signal.attributes);
  // Self-close when there is no inner text — conventional XML shape for empty elements.
  if (!signal.contents) return `<${signal.type}${attributesXml} />`;
  return `<${signal.type}${attributesXml}>${escapeXml(signal.contents)}</${signal.type}>`;
}

// Normalize the narrow signal-contents input (string OR text/file parts array) into a single
// canonical MastraDBMessage. Once we have this, the LLM and DB projections both read from the
// same walked representation instead of each re-walking the raw input with its own duck-typing.
function normalizeContents(contents: AgentSignalContents): MastraDBMessage[] {
  const parts: MastraMessagePart[] =
    typeof contents === 'string'
      ? [{ type: 'text', text: contents }]
      : contents.map(part =>
          part.type === 'file'
            ? {
                type: 'file',
                data: part.data,
                mimeType: part.mediaType,
                ...(part.filename ? { filename: part.filename } : {}),
              }
            : { type: 'text', text: part.text },
        );
  return [
    {
      id: crypto.randomUUID(),
      role: 'user',
      createdAt: new Date(),
      content: { format: 2, parts },
    },
  ];
}

// Flatten the canonical normalized form back into the text-only parts a UI would render.
// Used by mastraDBMessageToSignal / dataPartToSignal to recover a string for non-user-message
// signals whose original contents weren't preserved in metadata.
function dbMessagesToText(dbMessages: MastraDBMessage[]): string {
  return dbMessages
    .flatMap(msg => msg.content?.parts ?? [])
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .filter(Boolean)
    .join('\n');
}

// Project the canonical normalized form into the MastraMessagePart[] shape stored on
// signal DB rows. Falls back to a single empty text part so consumers that assume non-empty
// parts arrays stay happy.
function dbMessagesToParts(dbMessages: MastraDBMessage[]): MastraMessagePart[] {
  const parts = dbMessages.flatMap(msg => msg.content?.parts ?? []);
  return parts.length > 0 ? parts : [{ type: 'text', text: '' }];
}

function hasMeaningfulAttributes(attributes?: AgentSignalInput['attributes']): boolean {
  if (!attributes) return false;
  return Object.keys(attributes).some(key => {
    const value = attributes[key];
    return value !== null && value !== undefined;
  });
}

// True when every part in the normalized form is a text part. Drives the choice between the
// "wrap as single CoreMessage" fast path and the multimodal handling below.
function isTextOnlyDb(dbMessages: MastraDBMessage[]): boolean {
  return dbMessages.every(msg => (msg.content?.parts ?? []).every(part => part.type === 'text'));
}

// Inline-wrap the first text part of the normalized DB messages with the signal's XML tag,
// or prefix a self-closing marker message when no text part exists. Keeps the wrapper
// adjacent to its payload so the model sees the marker and its text/file parts as one turn.
function injectMarkerInline(
  signal: Pick<AgentSignalInput, 'type' | 'contents' | 'attributes'>,
  dbMessages: MastraDBMessage[],
): BaseMessageListInput {
  let wrapped = false;
  const next = dbMessages.map(dbMsg => {
    if (wrapped || !dbMsg.content?.parts) return { ...dbMsg, role: 'user' as const };
    const parts: MastraMessagePart[] = [];
    for (const part of dbMsg.content.parts) {
      if (!wrapped && part.type === 'text') {
        wrapped = true;
        parts.push({ ...part, text: signalToXmlMarkup({ ...signal, contents: part.text }) });
      } else {
        parts.push(part);
      }
    }
    return { ...dbMsg, role: 'user' as const, content: { ...dbMsg.content, parts } };
  });

  if (wrapped) return next;

  // No text part anywhere — prepend a self-closing marker message so attributes still surface.
  const prefixMessage = {
    role: 'user',
    content: signalToXmlMarkup({ type: signal.type, attributes: signal.attributes }),
  } satisfies CoreMessage;
  return [prefixMessage, ...next];
}

// Build the LLM-facing projection from the pre-normalized canonical form. Three shapes:
//   1. user-message with no attributes → pass original contents through unchanged
//   2. text-only → single wrapped CoreMessage
//   3. multimodal → inline the marker into the first text part so the wrapper stays
//      adjacent to its payload (file/image parts ride along on the same turn)
function signalToLLMMessage(
  signal: Pick<AgentSignalInput, 'type' | 'contents' | 'attributes'>,
  normalized: MastraDBMessage[],
): BaseMessageListInput {
  const isUserMessage = signal.type === 'user-message';
  const hasAttrs = hasMeaningfulAttributes(signal.attributes);

  // user-message is the model's natural input language; pass through as a CoreMessage unless
  // attributes need surfacing. Non-user-message signals always wrap — the XML wrapper is what
  // tells the model "this is framework context, not a user/assistant turn".
  if (isUserMessage && !hasAttrs) {
    const content =
      typeof signal.contents === 'string'
        ? signal.contents
        : signal.contents.map(part =>
            part.type === 'file'
              ? {
                  type: 'file' as const,
                  data: part.data,
                  mimeType: part.mediaType,
                  ...(part.filename ? { filename: part.filename } : {}),
                }
              : { type: 'text' as const, text: part.text },
          );
    return [{ role: 'user', content } satisfies CoreMessage];
  }

  // Text-only fast path: emit a single wrapped user message. user role because providers reject
  // system role mid-conversation, and assistant role would confuse the model about who spoke.
  if (isTextOnlyDb(normalized)) {
    const content = signalToXmlMarkup({ ...signal, contents: dbMessagesToText(normalized) });
    return [{ role: 'user', content } satisfies CoreMessage];
  }

  // Multimodal: inline-inject the marker into the first text part so the wrapper stays
  // adjacent to its payload. Works for both user-message (attributes like messageId tie to
  // the user's text) and framework signals (the reminder text becomes the wrapper's body
  // alongside the file/image part).
  return injectMarkerInline(signal, normalized);
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
  normalized: MastraDBMessage[],
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
      parts: dbMessagesToParts(normalized),
      metadata: {
        signal: {
          id: signal.id,
          type: signal.type,
          createdAt: signal.createdAt.toISOString(),
          contents: signal.contents,
          ...(signal.attributes ? { attributes: signal.attributes } : {}),
          ...(signal.metadata ? { metadata: signal.metadata } : {}),
        },
      },
    },
  };
}

export function isCreatedAgentSignal(input: unknown): input is CreatedAgentSignal {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;

  const candidate = input as Partial<CreatedAgentSignal>;
  return candidate.__isCreatedSignal === true;
}

export function createSignal(input: AgentSignalInput): CreatedAgentSignal {
  const signal = normalizeSignal(input);
  // Walk contents once via MessageList; both toDBMessage and toLLMMessage read from the
  // memoized canonical form instead of duck-typing the raw input shape themselves.
  let normalizedCache: MastraDBMessage[] | undefined;
  const normalized = () => (normalizedCache ??= normalizeContents(signal.contents));

  return {
    ...signal,
    __isCreatedSignal: true as const,
    toDBMessage: options => signalToDBMessage(signal, normalized(), options),
    toLLMMessage: () => signalToLLMMessage(signal, normalized()),
    toDataPart: () => signalToDataPart(signal),
  };
}

export function signalToMessage(signal: AgentSignalInput | CreatedAgentSignal): BaseMessageListInput {
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
    metadata:
      signalMetadata?.metadata && typeof signalMetadata.metadata === 'object' && !Array.isArray(signalMetadata.metadata)
        ? (signalMetadata.metadata as AgentSignalInput['metadata'])
        : undefined,
  };

  return createSignal(
    type === 'user-message'
      ? { ...base, type, contents }
      : { ...base, type, contents: dbMessagesToText(normalizeContents(contents)) },
  );
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  return createSignal(
    part.data.type === 'user-message'
      ? { ...part.data, type: 'user-message' }
      : { ...part.data, contents: dbMessagesToText(normalizeContents(part.data.contents)) },
  );
}
