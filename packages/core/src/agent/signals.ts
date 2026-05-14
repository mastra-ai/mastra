import type { CoreMessage, FilePart, TextPart } from '@internal/ai-sdk-v4';

import type { BaseMessageListInput } from './message-list';
import { convertDataContentToBase64String } from './message-list/prompt/data-content';
import type { MastraDBMessage, MastraMessagePart } from './message-list/state/types';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalType = 'user-message' | 'system-reminder' | string;

/**
 * Canonical input shape for `signal.contents`. Signals represent a single user
 * turn, so the contents are either a plain text string or a parts array of
 * text + file parts (mirrors AI SDK v4 `TextPart` / `FilePart`). Anything
 * richer (tool calls, reasoning, multiple turns) is not a signal and should go
 * through the agent stream directly.
 */
export type AgentSignalContents = string | Array<TextPart | FilePart>;

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

// Convert the narrow signal-contents input (string OR v4 TextPart/FilePart) into the canonical
// MastraMessagePart[] used by storage. createSignal runs this once at the boundary so every
// downstream projection (LLM, DB, data part) reads from the same walked representation.
// FilePart's `data` is `DataContent | URL` at the input boundary; storage stores it as a
// string (base64 for binary, stringified URL for URL instances) so DB rows stay JSON-safe.
function contentsToMessageParts(contents: AgentSignalContents): MastraMessagePart[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  return contents.map(part => {
    if (part.type === 'file') {
      const data = part.data instanceof URL ? part.data.toString() : convertDataContentToBase64String(part.data);
      return {
        type: 'file',
        data,
        mimeType: part.mimeType,
        ...(part.filename ? { filename: part.filename } : {}),
      };
    }
    return { type: 'text', text: part.text };
  });
}

// Flatten the canonical parts back to a plain string. Used to recover text for non-user-message
// signals during rehydration when the round-trip target is a string.
function partsToText(parts: MastraMessagePart[]): string {
  return parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .filter(Boolean)
    .join('\n');
}

// Reverse of contentsToMessageParts: project canonical storage parts back into the public
// AgentSignalContents shape. Storage and the public FilePart both use `mimeType`, so this is
// purely a filter + structural narrowing — non-text/file parts (shouldn't exist on a signal
// row, but the storage type permits richer parts) are dropped.
function partsToSignalContents(parts: MastraMessagePart[]): AgentSignalContents {
  const out: Array<TextPart | FilePart> = [];
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      out.push({ type: 'text', text: part.text });
    } else if (part.type === 'file' && typeof (part as { data?: unknown }).data === 'string') {
      const file = part as { data: string; mimeType?: string; filename?: string };
      out.push({
        type: 'file',
        data: file.data,
        mimeType: typeof file.mimeType === 'string' ? file.mimeType : '',
        ...(typeof file.filename === 'string' ? { filename: file.filename } : {}),
      });
    }
  }
  // String fast path: a single text part round-trips back to a bare string. Anything richer
  // stays as a parts array.
  if (out.length === 1 && out[0]?.type === 'text') return out[0].text;
  return out;
}

// Build the v4 UserContent shape expected on a CoreMessage from canonical parts. Both the
// storage parts and v4 UserContent's FilePart use `mimeType`, so this is mostly a filter +
// structural narrowing.
function partsToUserContent(parts: MastraMessagePart[]): string | Array<TextPart | FilePart> {
  // Single text part → bare string (provider-natural).
  if (parts.length === 1 && parts[0]?.type === 'text') return parts[0].text;
  const out: Array<TextPart | FilePart> = [];
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      out.push({ type: 'text', text: part.text });
    } else if (part.type === 'file' && typeof (part as { data?: unknown }).data === 'string') {
      const file = part as { data: string; mimeType?: string; filename?: string };
      out.push({
        type: 'file',
        data: file.data,
        mimeType: typeof file.mimeType === 'string' ? file.mimeType : '',
        ...(typeof file.filename === 'string' ? { filename: file.filename } : {}),
      });
    }
  }
  return out;
}

function hasMeaningfulAttributes(attributes?: AgentSignalInput['attributes']): boolean {
  if (!attributes) return false;
  return Object.keys(attributes).some(key => {
    const value = attributes[key];
    return value !== null && value !== undefined;
  });
}

// Inline-wrap the first text part with the signal's XML tag, or prefix a self-closing marker
// message when no text part exists. Keeps the wrapper adjacent to its payload so the model
// sees the marker and its text/file parts as one turn.
function injectMarkerInline(
  signal: Pick<AgentSignalInput, 'type' | 'attributes'>,
  parts: MastraMessagePart[],
): BaseMessageListInput {
  let wrapped = false;
  const wrappedParts: MastraMessagePart[] = [];
  for (const part of parts) {
    if (!wrapped && part.type === 'text' && typeof part.text === 'string') {
      wrapped = true;
      wrappedParts.push({ ...part, text: signalToXmlMarkup({ ...signal, contents: part.text }) });
    } else {
      wrappedParts.push(part);
    }
  }

  if (wrapped) {
    return [{ role: 'user', content: partsToUserContent(wrappedParts) } satisfies CoreMessage];
  }

  // No text part anywhere — emit a self-closing marker then the payload as a second user
  // message, so attributes still surface alongside the file/image parts.
  const prefixMessage = {
    role: 'user',
    content: signalToXmlMarkup({ type: signal.type, attributes: signal.attributes }),
  } satisfies CoreMessage;
  return [prefixMessage, { role: 'user', content: partsToUserContent(parts) } satisfies CoreMessage];
}

// Build the LLM-facing projection from the canonical parts. Three shapes:
//   1. user-message with no attributes → pass parts through as a CoreMessage (no wrapper)
//   2. text-only with attrs (or non-user-message text-only) → single wrapped CoreMessage
//   3. multimodal with attrs/non-user-message → inline-inject the marker into the first text
//      part so the wrapper stays adjacent to its payload (file/image parts ride along)
function signalToLLMMessage(
  signal: Pick<AgentSignalInput, 'type' | 'attributes'>,
  parts: MastraMessagePart[],
): BaseMessageListInput {
  const isUserMessage = signal.type === 'user-message';
  const hasAttrs = hasMeaningfulAttributes(signal.attributes);

  // user-message is the model's natural input language; pass through as a CoreMessage unless
  // attributes need surfacing. Non-user-message signals always wrap — the XML wrapper is what
  // tells the model "this is framework context, not a user/assistant turn".
  if (isUserMessage && !hasAttrs) {
    return [{ role: 'user', content: partsToUserContent(parts) } satisfies CoreMessage];
  }

  // Text-only fast path: emit a single wrapped user message. user role because providers reject
  // system role mid-conversation, and assistant role would confuse the model about who spoke.
  if (parts.every(part => part.type === 'text')) {
    const content = signalToXmlMarkup({ ...signal, contents: partsToText(parts) });
    return [{ role: 'user', content } satisfies CoreMessage];
  }

  // Multimodal: inline-inject the marker into the first text part so the wrapper stays
  // adjacent to its payload. Works for both user-message (attributes like messageId tie to
  // the user's text) and framework signals (the reminder text becomes the wrapper's body
  // alongside the file/image part).
  return injectMarkerInline(signal, parts);
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
  parts: MastraMessagePart[],
  options?: { threadId?: string; resourceId?: string },
): MastraDBMessage {
  // content.parts is the single source of truth for the signal payload. We deliberately do not
  // duplicate signal.contents into metadata.signal — that stash doubled storage (especially
  // painful for base64 file data) and made round-trips ambiguous. Rehydration walks parts.
  return {
    id: signal.id,
    role: 'signal',
    createdAt: signal.createdAt,
    threadId: options?.threadId,
    resourceId: options?.resourceId,
    type: signal.type,
    content: {
      format: 2,
      parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
      metadata: {
        signal: {
          id: signal.id,
          type: signal.type,
          createdAt: signal.createdAt.toISOString(),
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
  // Convert input contents into canonical MastraMessagePart[] once at the boundary. Every
  // downstream projection (LLM, DB) reads from this representation, so input-shape duck-typing
  // lives only in contentsToMessageParts.
  const parts = contentsToMessageParts(signal.contents);

  return {
    ...signal,
    __isCreatedSignal: true as const,
    toDBMessage: options => signalToDBMessage(signal, parts, options),
    toLLMMessage: () => signalToLLMMessage(signal, parts),
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
  // Reconstruct contents from content.parts — the canonical source. Legacy rows (pre stash
  // removal) preserved the original input shape on metadata.signal.contents; honour that
  // fallback so existing DBs keep round-tripping.
  const legacyContents =
    signalMetadata && 'contents' in signalMetadata ? (signalMetadata.contents as AgentSignalContents) : undefined;
  const partsContents = partsToSignalContents(message.content.parts);
  const contents = legacyContents ?? partsContents;
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

  // Non-user-message signals flatten to a string — their original contents were never
  // multimodal-shaped on the wire (system reminders etc).
  const finalContents =
    type === 'user-message' ? contents : typeof contents === 'string' ? contents : partsToText(message.content.parts);

  return createSignal({ ...base, type, contents: finalContents } as AgentSignalInput);
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  if (part.data.type === 'user-message') {
    return createSignal({ ...part.data, type: 'user-message' });
  }
  // Non-user-message signals flatten to a string on rehydration.
  const contents =
    typeof part.data.contents === 'string'
      ? part.data.contents
      : partsToText(contentsToMessageParts(part.data.contents));
  return createSignal({ ...part.data, contents });
}
