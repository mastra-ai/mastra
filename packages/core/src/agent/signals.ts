import type { CoreMessage, FilePart, TextPart } from '@internal/ai-sdk-v4';

import { convertDataContentToBase64String } from './message-list/prompt/data-content';
import type { MastraDBMessage, MastraMessagePart } from './message-list/state/types';
import type { BaseMessageListInput } from './message-list/types';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalType = 'user-message' | 'system-reminder' | string;

/**
 * Canonical input shape for `signal.contents`. Signals represent a single user
 * turn, so the contents are either a plain text string or a parts array of
 * text + file parts. Anything richer (tool calls, reasoning, multiple turns)
 * is not a signal and should go through the agent stream directly.
 *
 * Field naming matches AI SDK v4 (`mimeType`) which is also the storage
 * convention (`MastraMessagePart`) — so there's no field translation between
 * what callers pass in and what gets persisted.
 */
export type AgentSignalContents = string | Array<TextPart | FilePart>;

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalInput = {
  id?: string;
  createdAt?: Date | string;
  type: AgentSignalType;
  contents: AgentSignalContents;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

/**
 * @deprecated Use {@link AgentSignalInput} directly. The split between user-message
 * and other signal types was a vestige of an older design — both accept the same
 * `contents` shape.
 */
export type UserMessageAgentSignalInput = AgentSignalInput;

/**
 * @deprecated Use {@link AgentSignalInput} directly. The split between user-message
 * and other signal types was a vestige of an older design — both accept the same
 * `contents` shape.
 */
export type ContextAgentSignalInput = AgentSignalInput;

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
// downstream projection (LLM, DB, data part) reads from the same walked representation. FilePart's
// `data` is `DataContent | URL` at the input boundary; storage stores it as a string (base64 for
// binary, stringified URL for URL instances) so DB rows stay JSON-safe. Public input naming
// (`mimeType`) matches storage (`mimeType`), so no field rename is needed — just a structural
// narrowing plus the `data` normalization.
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
// AgentSignalContents shape. Both shapes use `mimeType`, so this is pure structural narrowing.
// Non-text/file parts (shouldn't exist on a signal row, but the storage type permits richer
// parts) are dropped.
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

function hasMeaningfulAttributes(attributes?: AgentSignalInput['attributes']): boolean {
  if (!attributes) return false;
  return Object.keys(attributes).some(key => {
    const value = attributes[key];
    return value !== null && value !== undefined;
  });
}

// Inline-wrap the first text part with the signal's XML tag. If there's no text part, prepend
// a self-closing marker as a synthetic first part so attributes still surface alongside the
// file/image payload on the same turn.
function injectMarkerInline(
  signal: Pick<AgentSignalInput, 'type' | 'attributes'>,
  parts: MastraMessagePart[],
): MastraMessagePart[] {
  let wrapped = false;
  const out: MastraMessagePart[] = [];
  for (const part of parts) {
    if (!wrapped && part.type === 'text' && typeof part.text === 'string') {
      wrapped = true;
      out.push({ ...part, text: signalToXmlMarkup({ ...signal, contents: part.text }) });
    } else {
      out.push(part);
    }
  }
  if (!wrapped) {
    const markerText = signalToXmlMarkup({ type: signal.type, attributes: signal.attributes });
    out.unshift({ type: 'text', text: markerText });
  }
  return out;
}

// Build the LLM-facing projection from the canonical parts. Returns a v4 CoreMessage with
// role: 'user' (a prompt turn the model sees, not a signal row). The XML wrapper carries the
// attributes inline so there's no metadata.signal here.
function signalToLLMMessage(
  signal: Pick<AgentSignalInput, 'type' | 'attributes'>,
  parts: MastraMessagePart[],
): CoreMessage {
  const isUserMessage = signal.type === 'user-message';
  const hasAttrs = hasMeaningfulAttributes(signal.attributes);

  let content: string | MastraMessagePart[];
  if (isUserMessage && !hasAttrs) {
    // user-message with no attributes — pass parts through unchanged. Collapse a single text
    // part to a bare string so providers get their natural prompt shape.
    content = parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts;
  } else if (parts.every(part => part.type === 'text')) {
    // Text-only: flatten to one wrapped string.
    content = signalToXmlMarkup({ ...signal, contents: partsToText(parts) });
  } else {
    // Multimodal: inline-wrap the marker alongside the file/image payload.
    content = injectMarkerInline(signal, parts);
  }

  return { role: 'user', content } as CoreMessage;
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

  return createSignal({ ...base, type, contents });
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  return createSignal(part.data);
}
