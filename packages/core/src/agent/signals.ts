import type { FilePart, TextPart, UserModelMessage } from '@internal/ai-sdk-v5';

import { convertDataContentToBase64String } from './message-list/prompt/data-content';
import type { MastraDBMessage, MastraMessagePart, MastraProviderMetadata } from './message-list/state/types';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalType = 'user-message' | 'system-reminder' | string;

export type SignalPart = TextPart | SignalFilePart;
type SignalFilePart = {
  type: 'file';
  data: string;
  mediaType: string;
  filename?: string;
  providerOptions?: MastraProviderMetadata;
};

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalContents = string | Array<TextPart | FilePart>;

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalInput = {
  id?: string;
  createdAt?: Date | string;
  acceptedAt?: Date | string;
  type: AgentSignalType;
  contents: AgentSignalContents;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
  /**
   * Provider options attached to the resulting prompt turn. Surfaces as `providerOptions` on the
   * `UserModelMessage` sent to the model and as `content.providerMetadata` on the persisted DB
   * message (also visible to UI consumers via `useChat` message metadata).
   */
  providerOptions?: MastraProviderMetadata;
};

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
    acceptedAt?: string;
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
  acceptedAt?: Date;
  toDBMessage: (options?: { threadId?: string; resourceId?: string }) => MastraDBMessage;
  toLLMMessage: () => UserModelMessage;
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
    acceptedAt:
      signal.acceptedAt instanceof Date
        ? signal.acceptedAt
        : signal.acceptedAt
          ? new Date(signal.acceptedAt)
          : undefined,
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

export function signalToXmlMarkup(
  signal: Pick<AgentSignalInput, 'type' | 'attributes'> & { contents?: string },
): string {
  assertXmlName(signal.type, 'tag name');
  const attributesXml = signalAttributesToXml(signal.attributes);
  if (!signal.contents) return `<${signal.type}${attributesXml} />`;
  return `<${signal.type}${attributesXml}>${escapeXml(signal.contents)}</${signal.type}>`;
}

// Recover legacy metadata.signal.contents shapes (pre-narrowing) into the current
// AgentSignalContents. Older rows could stash any of:
//   - string                                          (most signals)
//   - Array<TextPart | FilePart> with mediaType       (TUI image messages)
//   - { role: 'user', content: string | Array<...> } (TUI createUserSignalContent)
//   - CoreUserMessage[] / string[]                    (React hook BaseMessageListInput)
// Anything that doesn't decode cleanly returns undefined so the caller can fall back to
// the canonical content.parts projection.
function legacyContentsToSignalContents(value: unknown): AgentSignalContents | undefined {
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    const parts: Array<TextPart | FilePart> = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        parts.push({ type: 'text', text: entry });
        continue;
      }
      const decoded = legacyEntryToParts(entry);
      if (!decoded) return undefined;
      parts.push(...decoded);
    }
    return collapseLegacyParts(parts);
  }

  const decoded = legacyEntryToParts(value);
  return decoded ? collapseLegacyParts(decoded) : undefined;
}

function legacyEntryToParts(entry: unknown): Array<TextPart | FilePart> | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const record = entry as Record<string, unknown>;

  // CoreUserMessage wrapper: { role: 'user', content: string | Array<...> }.
  if (record.role === 'user' && 'content' in record) {
    const content = record.content;
    if (typeof content === 'string') return [{ type: 'text', text: content }];
    if (Array.isArray(content)) {
      const inner: Array<TextPart | FilePart> = [];
      for (const part of content) {
        const decoded = legacyPartToSignalPart(part);
        if (!decoded) return undefined;
        inner.push(decoded);
      }
      return inner;
    }
    return undefined;
  }

  // Bare TextPart / FilePart / ImagePart.
  const part = legacyPartToSignalPart(record);
  return part ? [part] : undefined;
}

function legacyPartToSignalPart(part: unknown): TextPart | FilePart | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const record = part as Record<string, unknown>;
  const providerOptions =
    record.providerOptions && typeof record.providerOptions === 'object' && !Array.isArray(record.providerOptions)
      ? (record.providerOptions as MastraProviderMetadata)
      : undefined;

  if (record.type === 'text' && typeof record.text === 'string') {
    return { type: 'text', text: record.text, ...(providerOptions ? { providerOptions } : {}) };
  }

  // Accept both shapes here: rows written by main + the v4-shaped narrowed branch used
  // `mimeType`; rows that came in as v5 user input (and current canonical) use `mediaType`.
  if (record.type === 'file' || record.type === 'image') {
    const data = record.type === 'image' ? (record.image ?? record.data) : record.data;
    if (typeof data !== 'string') return undefined;
    const mediaType =
      typeof record.mediaType === 'string'
        ? record.mediaType
        : typeof record.mimeType === 'string'
          ? record.mimeType
          : record.type === 'image'
            ? 'image/png'
            : '';
    if (!mediaType) return undefined;
    return {
      type: 'file',
      data,
      mediaType,
      ...(typeof record.filename === 'string' ? { filename: record.filename } : {}),
      ...(providerOptions ? { providerOptions } : {}),
    };
  }

  return undefined;
}

function collapseLegacyParts(parts: Array<TextPart | FilePart>): AgentSignalContents | undefined {
  if (parts.length === 0) return undefined;
  const first = parts[0];
  if (parts.length === 1 && first?.type === 'text') return first.text;
  return parts;
}

function contentsToSignalParts(contents: AgentSignalContents): SignalPart[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  return contents.map(part => {
    if (part.type === 'file') {
      const data = part.data instanceof URL ? part.data.toString() : convertDataContentToBase64String(part.data);
      return {
        type: 'file',
        data,
        mediaType: part.mediaType,
        ...(part.filename ? { filename: part.filename } : {}),
        ...(part.providerOptions ? { providerOptions: part.providerOptions as MastraProviderMetadata } : {}),
      };
    }
    return {
      type: 'text',
      text: part.text,
      ...(part.providerOptions ? { providerOptions: part.providerOptions as MastraProviderMetadata } : {}),
    };
  });
}

// Narrow a storage parts array down to SignalPart. Signal rows should only ever contain text/file
// parts (that's what contentsToSignalParts produces), but the storage type permits richer parts —
// so the read boundary filters defensively.
function storagePartsToSignalParts(parts: MastraMessagePart[]): SignalPart[] {
  const out: SignalPart[] = [];
  for (const part of parts) {
    const providerOptions = (part as { providerMetadata?: MastraProviderMetadata }).providerMetadata;
    if (part.type === 'text') {
      out.push({
        type: 'text',
        text: part.text,
        ...(providerOptions ? { providerOptions } : {}),
      });
    } else if (part.type === 'file' && typeof (part as { data?: unknown }).data === 'string') {
      const file = part as { data: string; mimeType?: string; filename?: string };
      out.push({
        type: 'file',
        data: file.data,
        mediaType: typeof file.mimeType === 'string' ? file.mimeType : '',
        ...(typeof file.filename === 'string' ? { filename: file.filename } : {}),
        ...(providerOptions ? { providerOptions } : {}),
      });
    }
  }
  return out;
}

// Project canonical signal parts back into the public AgentSignalContents shape. Collapses a
// single text part to a bare string; otherwise returns the parts unchanged (both internal
// SignalPart and the public v5 FilePart use `mediaType`).
function partsToSignalContents(parts: SignalPart[]): AgentSignalContents {
  if (parts.length === 1 && parts[0]?.type === 'text' && !parts[0].providerOptions) return parts[0].text;
  return parts.map<TextPart | FilePart>(part =>
    part.type === 'file'
      ? {
          type: 'file',
          data: part.data,
          mediaType: part.mediaType,
          ...(part.filename ? { filename: part.filename } : {}),
          ...(part.providerOptions ? { providerOptions: part.providerOptions } : {}),
        }
      : {
          type: 'text',
          text: part.text,
          ...(part.providerOptions ? { providerOptions: part.providerOptions } : {}),
        },
  );
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
function injectMarkerInline(signal: Pick<AgentSignalInput, 'type' | 'attributes'>, parts: SignalPart[]): SignalPart[] {
  let wrapped = false;
  const out: SignalPart[] = [];
  for (const part of parts) {
    if (!wrapped && part.type === 'text') {
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

// Build the LLM-facing projection from the canonical parts. Returns a v5 UserModelMessage
// (a prompt turn the model sees, not a signal row). The XML wrapper carries the attributes
// inline so there's no metadata.signal here.
function signalToLLMMessage(
  signal: Pick<AgentSignalInput, 'type' | 'attributes' | 'providerOptions'>,
  parts: SignalPart[],
): UserModelMessage {
  const isUserMessage = signal.type === 'user-message';
  const hasAttrs = hasMeaningfulAttributes(signal.attributes);

  const anyPartProviderOptions = parts.some(part => part.providerOptions);

  let content: UserModelMessage['content'];
  if (isUserMessage && !hasAttrs) {
    // user-message with no attributes — pass parts through unchanged. Collapse a single text
    // part to a bare string so providers get their natural prompt shape (unless the part
    // carries providerOptions, in which case we keep the parts array to preserve them).
    content = parts.length === 1 && parts[0]?.type === 'text' && !parts[0].providerOptions ? parts[0].text : parts;
  } else if (parts.every(part => part.type === 'text') && !anyPartProviderOptions) {
    // Text-only with no per-part providerOptions: flatten to one wrapped string.
    content = signalToXmlMarkup({ ...signal, contents: parts.map(part => part.text).join('\n') });
  } else {
    // Multimodal or per-part providerOptions present: inline-wrap the marker alongside the
    // payload so each part (and its providerOptions) is preserved.
    content = injectMarkerInline(signal, parts);
  }

  return {
    role: 'user',
    content,
    ...(signal.providerOptions ? { providerOptions: signal.providerOptions } : {}),
  };
}

function signalToDataPart(signal: ReturnType<typeof normalizeSignal>, parts: SignalPart[]): AgentSignalDataPart {
  return {
    type: `data-${signal.type}`,
    data: {
      id: signal.id,
      type: signal.type,
      contents: partsToSignalContents(parts),
      createdAt: signal.createdAt.toISOString(),
      ...(signal.acceptedAt ? { acceptedAt: signal.acceptedAt.toISOString() } : {}),
      ...(signal.attributes ? { attributes: signal.attributes } : {}),
      ...(signal.metadata ? { metadata: signal.metadata } : {}),
    },
  };
}

function signalToDBMessage(
  signal: ReturnType<typeof normalizeSignal>,
  parts: SignalPart[],
  options?: { threadId?: string; resourceId?: string },
): MastraDBMessage {
  const storageParts: MastraMessagePart[] =
    parts.length > 0
      ? parts.map(part =>
          part.type === 'file'
            ? {
                type: 'file',
                data: part.data,
                mimeType: part.mediaType,
                ...(part.filename ? { filename: part.filename } : {}),
                ...(part.providerOptions ? { providerMetadata: part.providerOptions } : {}),
              }
            : {
                type: 'text',
                text: part.text,
                ...(part.providerOptions ? { providerMetadata: part.providerOptions } : {}),
              },
        )
      : [{ type: 'text', text: '' }];
  return {
    id: signal.id,
    role: 'signal',
    createdAt: signal.createdAt,
    threadId: options?.threadId,
    resourceId: options?.resourceId,
    type: signal.type,
    content: {
      format: 2,
      parts: storageParts,
      ...(signal.providerOptions ? { providerMetadata: signal.providerOptions } : {}),
      metadata: {
        signal: {
          id: signal.id,
          type: signal.type,
          createdAt: signal.createdAt.toISOString(),
          ...(signal.acceptedAt ? { acceptedAt: signal.acceptedAt.toISOString() } : {}),
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
  const parts = contentsToSignalParts(signal.contents);

  return {
    ...signal,
    __isCreatedSignal: true as const,
    toDBMessage: options => signalToDBMessage(signal, parts, options),
    toLLMMessage: () => signalToLLMMessage(signal, parts),
    toDataPart: () => signalToDataPart(signal, parts),
  };
}

export function signalToMessage(signal: AgentSignalInput | CreatedAgentSignal): UserModelMessage {
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
  // removal) preserved the original input shape on metadata.signal.contents; recover whatever
  // we can from it (string, parts array, CoreUserMessage wrapper, CoreUserMessage[]) so files
  // and other non-text payloads keep loading. If the stash is unrecognisable, fall back to the
  // canonical parts projection.
  const rawLegacyContents = signalMetadata && 'contents' in signalMetadata ? signalMetadata.contents : undefined;
  const legacyContents = legacyContentsToSignalContents(rawLegacyContents);
  const partsContents = partsToSignalContents(storagePartsToSignalParts(message.content.parts));
  const contents = legacyContents ?? partsContents;
  const providerMetadata = message.content.providerMetadata;
  const base = {
    id: typeof signalMetadata?.id === 'string' ? signalMetadata.id : message.id,
    createdAt: typeof signalMetadata?.createdAt === 'string' ? signalMetadata.createdAt : message.createdAt,
    acceptedAt: typeof signalMetadata?.acceptedAt === 'string' ? signalMetadata.acceptedAt : undefined,
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
    providerOptions:
      providerMetadata && typeof providerMetadata === 'object' && !Array.isArray(providerMetadata)
        ? (providerMetadata as MastraProviderMetadata)
        : undefined,
  };

  return createSignal({ ...base, type, contents });
}

export function dataPartToSignal(part: AgentSignalDataPart): CreatedAgentSignal {
  return createSignal(part.data);
}

/**
 * Returns true when a signal type represents a data-part signal (prefixed with `data-`).
 * Data-part signals are streamed to subscribers but never included in the LLM prompt.
 */
export function isDataPartSignalType(type: string): boolean {
  return type.startsWith('data-');
}

/**
 * Create a DB message for a data-part signal.
 * These are persisted to storage but excluded from LLM prompts.
 */
export function dataPartSignalToDBMessage(
  dataPart: { type: `data-${string}`; data: unknown },
  options: { threadId: string; resourceId: string },
): MastraDBMessage {
  return {
    id: crypto.randomUUID(),
    role: 'signal',
    createdAt: new Date(),
    threadId: options.threadId,
    resourceId: options.resourceId,
    type: dataPart.type,
    content: {
      format: 2,
      parts: [{ type: 'text', text: '' }],
      metadata: {
        signal: {
          id: crypto.randomUUID(),
          type: dataPart.type,
          createdAt: new Date().toISOString(),
          metadata: { dataPartPayload: dataPart.data },
        },
      },
    },
  };
}
