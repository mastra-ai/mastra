import type { MastraMessagePart, MastraProviderMetadata } from './state/types';

type SpanChunkPayload = {
  id?: unknown;
  text?: unknown;
  data?: unknown;
  providerMetadata?: unknown;
};

export type SpanChunk = { type: string; payload?: unknown };

export type FoldedSpan = { part: MastraMessagePart; created: boolean };

type TextPart = Extract<MastraMessagePart, { type: 'text' }>;
type ReasoningPart = Extract<MastraMessagePart, { type: 'reasoning' }>;

const SPAN_CHUNK_TYPES = new Set([
  'text-start',
  'text-delta',
  'text-end',
  'reasoning-start',
  'reasoning-delta',
  'reasoning-end',
  'redacted-reasoning',
]);

export function isSpanChunk(type: string): boolean {
  return SPAN_CHUNK_TYPES.has(type);
}

function readPayload(chunk: SpanChunk): SpanChunkPayload {
  return typeof chunk.payload === 'object' && chunk.payload !== null ? (chunk.payload as SpanChunkPayload) : {};
}

function readSpanId(payload: SpanChunkPayload): string {
  return typeof payload.id === 'string' ? payload.id : '';
}

function readSpanText(payload: SpanChunkPayload): string {
  return typeof payload.text === 'string' ? payload.text : '';
}

function readProviderMetadata(payload: SpanChunkPayload): MastraProviderMetadata | undefined {
  return typeof payload.providerMetadata === 'object' && payload.providerMetadata !== null
    ? (payload.providerMetadata as MastraProviderMetadata)
    : undefined;
}

function isRedactedMetadata(providerMetadata: MastraProviderMetadata | undefined): boolean {
  return Object.values(providerMetadata ?? {}).some(value =>
    Boolean((value as { redactedData?: unknown })?.redactedData),
  );
}

function redactedReasoningPart(providerMetadata: MastraProviderMetadata | undefined): ReasoningPart {
  return {
    type: 'reasoning',
    reasoning: '',
    details: [{ type: 'redacted', data: '' }],
    providerMetadata,
  };
}

function emptyReasoningPart(providerMetadata: MastraProviderMetadata | undefined): ReasoningPart {
  return { type: 'reasoning', reasoning: '', details: [{ type: 'text', text: '' }], providerMetadata };
}

/**
 * Folds the text and reasoning span chunks of one assistant message into its
 * parts: a span opens on its first delta, grows on the next ones, and closes on
 * its end chunk so a provider that numbers content blocks per response cannot
 * append a later step into an earlier part.
 */
export class MessagePartSpans {
  #textParts = new Map<string, TextPart>();
  #reasoningParts = new Map<string, ReasoningPart>();
  #textMetadata = new Map<string, MastraProviderMetadata | undefined>();
  #reasoningMetadata = new Map<string, MastraProviderMetadata | undefined>();

  clear(): void {
    this.#textParts.clear();
    this.#reasoningParts.clear();
    this.#textMetadata.clear();
    this.#reasoningMetadata.clear();
  }

  flushSpansLeftOpen(parts: MastraMessagePart[]): void {
    for (const [id, providerMetadata] of this.#reasoningMetadata) {
      if (!this.#reasoningParts.has(id)) parts.push(emptyReasoningPart(providerMetadata));
    }
    for (const part of this.#textParts.values()) {
      if (!part.providerMetadata) delete part.providerMetadata;
    }
  }

  fold(parts: MastraMessagePart[], chunk: SpanChunk): FoldedSpan | undefined {
    const payload = readPayload(chunk);
    const id = readSpanId(payload);
    const providerMetadata = readProviderMetadata(payload);

    switch (chunk.type) {
      case 'text-start':
        this.#textMetadata.set(id, providerMetadata);
        return undefined;

      case 'text-delta': {
        const open = this.#textParts.get(id);
        const part = open ?? this.#openTextPart(parts, id, providerMetadata);
        part.text += readSpanText(payload);
        if (providerMetadata) part.providerMetadata = providerMetadata;
        return { part, created: !open };
      }

      case 'text-end': {
        const part = this.#textParts.get(id);
        this.#textParts.delete(id);
        this.#textMetadata.delete(id);
        if (!part) return undefined;
        if (providerMetadata) part.providerMetadata = providerMetadata;
        if (!part.providerMetadata) delete part.providerMetadata;
        return { part, created: false };
      }

      case 'reasoning-start': {
        if (!isRedactedMetadata(providerMetadata)) {
          this.#reasoningMetadata.set(id, providerMetadata);
          return undefined;
        }
        return { part: this.#pushReasoningPart(parts, id, redactedReasoningPart(providerMetadata)), created: true };
      }

      case 'reasoning-delta': {
        const open = this.#reasoningParts.get(id);
        const part = open ?? this.#openReasoningPart(parts, id, providerMetadata);
        const text = readSpanText(payload);
        part.reasoning = (part.reasoning ?? '') + text;
        const detail = part.details[0];
        if (detail?.type === 'text') detail.text = part.reasoning;
        if (providerMetadata) part.providerMetadata = providerMetadata;
        return { part, created: !open };
      }

      case 'reasoning-end': {
        const open = this.#reasoningParts.get(id);
        const metadata = providerMetadata ?? this.#reasoningMetadata.get(id);
        this.#reasoningParts.delete(id);
        this.#reasoningMetadata.delete(id);
        if (open) {
          if (providerMetadata) open.providerMetadata = providerMetadata;
          return { part: open, created: false };
        }
        // OpenAI needs an item_reference for the tool calls that follow a reasoning span.
        parts.push(emptyReasoningPart(metadata));
        return { part: parts[parts.length - 1]!, created: true };
      }

      case 'redacted-reasoning':
        parts.push(redactedReasoningPart(providerMetadata));
        return { part: parts[parts.length - 1]!, created: true };

      default:
        return undefined;
    }
  }

  #openTextPart(
    parts: MastraMessagePart[],
    id: string,
    providerMetadata: MastraProviderMetadata | undefined,
  ): TextPart {
    const part: TextPart = {
      type: 'text',
      text: '',
      providerMetadata: this.#textMetadata.get(id) ?? providerMetadata,
    };
    this.#textParts.set(id, part);
    parts.push(part);
    return part;
  }

  #openReasoningPart(
    parts: MastraMessagePart[],
    id: string,
    providerMetadata: MastraProviderMetadata | undefined,
  ): ReasoningPart {
    return this.#pushReasoningPart(parts, id, {
      type: 'reasoning',
      reasoning: '',
      details: [{ type: 'text', text: '' }],
      providerMetadata: this.#reasoningMetadata.get(id) ?? providerMetadata,
    });
  }

  #pushReasoningPart(parts: MastraMessagePart[], id: string, part: ReasoningPart): ReasoningPart {
    this.#reasoningParts.set(id, part);
    parts.push(part);
    return part;
  }
}
