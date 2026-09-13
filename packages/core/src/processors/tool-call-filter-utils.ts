import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../agent/message-list';

const MODEL_OUTPUT_TRUNCATION_SUFFIX = '\n[truncated]';
const MAX_MODEL_OUTPUT_TRAVERSAL_DEPTH = 64;
const MAX_MODEL_OUTPUT_TRAVERSAL_NODES = 10_000;

export type ToolCallFilteringOptions = {
  exclude?: string[];
  preserveModelOutput?: boolean;
  /**
   * Tool names whose compact model output may be retained when their raw tool
   * payload is filtered. When provided, this allowlist takes precedence over
   * `preserveModelOutput`; an empty list retains no model output.
   */
  preserveModelOutputFor?: string[];
  maxModelOutputBytes?: number;
};

type NormalizedToolCallFilteringOptions = {
  exclude: string[] | 'all';
  preserveModelOutputFor: string[] | 'all';
  maxModelOutputBytes?: number;
};

type ModelOutputTraversal = {
  seen: WeakSet<object>;
  depth: number;
  nodes: number;
  exhausted: boolean;
};

type OwnDataProperty = { kind: 'missing' } | { kind: 'accessor' } | { kind: 'data'; value: unknown };

type ToolCallMessageFilterBehavior = {
  stripMessageProviderMetadata?: boolean;
};

type MessagePart = MastraDBMessage['content']['parts'][number];

export function normalizeToolCallFilterExclude(exclude: unknown): string[] | 'all' {
  if (exclude == null) return 'all';
  if (!Array.isArray(exclude) || exclude.some(toolName => typeof toolName !== 'string')) {
    throw new TypeError('Tool call filter options.exclude must be an array of strings when provided');
  }
  return exclude;
}

export function normalizeToolCallFilterMaxModelOutputBytes(maxModelOutputBytes: unknown): number | undefined {
  if (maxModelOutputBytes === undefined) return undefined;
  if (typeof maxModelOutputBytes !== 'number' || !Number.isFinite(maxModelOutputBytes) || maxModelOutputBytes < 0) {
    throw new TypeError(
      'Tool call filter options.maxModelOutputBytes must be a finite non-negative number when provided',
    );
  }
  return Math.floor(maxModelOutputBytes);
}

function normalizePreservedModelOutputTools(
  preserveModelOutput: boolean | undefined,
  preserveModelOutputFor: unknown,
): string[] | 'all' {
  if (preserveModelOutputFor === undefined) return preserveModelOutput ? 'all' : [];
  if (!Array.isArray(preserveModelOutputFor) || preserveModelOutputFor.some(toolName => typeof toolName !== 'string')) {
    throw new TypeError('Tool call filter options.preserveModelOutputFor must be an array of strings when provided');
  }
  return preserveModelOutputFor;
}

function getOwnDataProperty(value: object, key: PropertyKey): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return { kind: 'missing' };
  if (!('value' in descriptor)) return { kind: 'accessor' };
  return { kind: 'data', value: descriptor.value };
}

function normalizeOptions(options: ToolCallFilteringOptions | null): NormalizedToolCallFilteringOptions {
  const resolvedOptions = options ?? {};
  const exclude = (resolvedOptions as { exclude?: unknown }).exclude;
  const maxModelOutputBytes = normalizeToolCallFilterMaxModelOutputBytes(
    (resolvedOptions as { maxModelOutputBytes?: unknown }).maxModelOutputBytes,
  );
  return {
    exclude: normalizeToolCallFilterExclude(exclude),
    preserveModelOutputFor: normalizePreservedModelOutputTools(
      resolvedOptions.preserveModelOutput,
      (resolvedOptions as { preserveModelOutputFor?: unknown }).preserveModelOutputFor,
    ),
    ...(maxModelOutputBytes === undefined
      ? {}
      : {
          maxModelOutputBytes,
        }),
  };
}

function getMessageParts(message: MastraDBMessage): MastraMessagePart[] {
  const content = message.content as unknown;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return [];
  const parts = (content as { parts?: unknown }).parts;
  return Array.isArray(parts) ? (parts as MastraMessagePart[]) : [];
}

export function getSealedMessageBoundary(
  message: MastraDBMessage,
): { index: number; part: MessagePart; sealedAt: number } | undefined {
  const parts = getMessageParts(message);
  const messageContent = message.content as unknown;
  if (!messageContent || typeof messageContent !== 'object' || Array.isArray(messageContent)) return undefined;
  const messageMetadata = (messageContent as { metadata?: unknown }).metadata;
  if (!messageMetadata || typeof messageMetadata !== 'object' || Array.isArray(messageMetadata)) return undefined;
  const mastraMetadata = (messageMetadata as { mastra?: unknown }).mastra;
  if (!mastraMetadata || typeof mastraMetadata !== 'object' || Array.isArray(mastraMetadata)) return undefined;
  if ((mastraMetadata as { sealed?: unknown }).sealed !== true) return undefined;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const partMetadata = (parts[index] as { metadata?: unknown }).metadata;
    if (!partMetadata || typeof partMetadata !== 'object' || Array.isArray(partMetadata)) continue;
    const partMastraMetadata = (partMetadata as { mastra?: unknown }).mastra;
    if (!partMastraMetadata || typeof partMastraMetadata !== 'object' || Array.isArray(partMastraMetadata)) continue;
    const sealedAt = (partMastraMetadata as { sealedAt?: unknown }).sealedAt;
    if (typeof sealedAt === 'number') {
      return { index, part: parts[index]!, sealedAt };
    }
  }

  return undefined;
}

function getTopLevelToolInvocations(
  message: MastraDBMessage,
): NonNullable<MastraDBMessage['content']['toolInvocations']> {
  const content = message.content as unknown;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return [];
  const toolInvocations = (content as { toolInvocations?: unknown }).toolInvocations;
  return Array.isArray(toolInvocations)
    ? (toolInvocations as NonNullable<MastraDBMessage['content']['toolInvocations']>)
    : [];
}

function getToolInvocations(message: MastraDBMessage): MastraToolInvocationPart[] {
  return getMessageParts(message).filter((part): part is MastraToolInvocationPart => part.type === 'tool-invocation');
}

function hasTopLevelTextContent(message: MastraDBMessage): boolean {
  const content = message.content as unknown;
  if (typeof content === 'string') return content.trim().length > 0;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const topLevelContent = (content as { content?: unknown }).content;
  return typeof topLevelContent === 'string' && topLevelContent.trim().length > 0;
}

type ToolStateFilter = {
  excludedToolNames: string[] | 'all';
  excludedToolCallIds: Set<string>;
  preserveToolCallIds: Set<string>;
};

function shouldFilterToolState(data: unknown, filter: ToolStateFilter, fallbackToolName?: string): boolean {
  const stateData = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const toolCallId = typeof stateData.toolCallId === 'string' ? stateData.toolCallId : undefined;
  if (toolCallId && filter.preserveToolCallIds.has(toolCallId)) return false;

  if (filter.excludedToolNames === 'all') return true;

  const toolName = typeof stateData.toolName === 'string' ? stateData.toolName : fallbackToolName;
  return (
    (toolName !== undefined && filter.excludedToolNames.includes(toolName)) ||
    (toolCallId !== undefined && filter.excludedToolCallIds.has(toolCallId))
  );
}

function filterToolStateMetadata(
  metadata: MastraDBMessage['content']['metadata'],
  filter: ToolStateFilter,
): MastraDBMessage['content']['metadata'] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return metadata;

  let filteredMetadata = metadata;
  for (const metadataKey of ['suspendedTools', 'pendingToolApprovals'] as const) {
    const toolStates = metadata[metadataKey];
    if (!toolStates || typeof toolStates !== 'object' || Array.isArray(toolStates)) continue;

    const retainedEntries = Object.entries(toolStates).filter(
      ([toolNameOrCallId, state]) => !shouldFilterToolState(state, filter, toolNameOrCallId),
    );
    if (retainedEntries.length === Object.keys(toolStates).length) continue;

    if (filteredMetadata === metadata) filteredMetadata = { ...metadata };
    if (retainedEntries.length === 0) {
      delete filteredMetadata[metadataKey];
    } else {
      filteredMetadata[metadataKey] = Object.fromEntries(retainedEntries);
    }
  }

  return filteredMetadata;
}

function shouldFilterToolStatePart(part: MastraMessagePart, filter: ToolStateFilter): boolean {
  if (part.type !== 'data-tool-call-approval' && part.type !== 'data-tool-call-suspended') return false;
  return shouldFilterToolState((part as { data?: unknown }).data, filter);
}

function getToolCallId(invocation: MastraToolInvocationPart['toolInvocation']): string | undefined {
  return invocation.toolCallId ?? (invocation as { toolCall?: { id?: string } }).toolCall?.id;
}

function safeJsonStringify(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : null;
  } catch {
    return null;
  }
}

class BoundedTextBuilder {
  private chunks: string[] = [];
  private length = 0;

  constructor(private readonly maxCodeUnits: number) {}

  get isFull(): boolean {
    return this.length >= this.maxCodeUnits;
  }

  get remaining(): number {
    return Math.max(0, this.maxCodeUnits - this.length);
  }

  append(text: string): void {
    const remaining = this.remaining;
    if (remaining === 0 || text.length === 0) return;
    const bounded = text.length <= remaining ? text : text.slice(0, remaining);
    this.chunks.push(bounded);
    this.length += bounded.length;
  }

  toString(): string {
    return this.chunks.join('');
  }
}

function appendBoundedJsonString(builder: BoundedTextBuilder, value: string): void {
  builder.append('"');
  let runStart = 0;

  for (let index = 0; index < value.length && !builder.isFull; index += 1) {
    const codeUnit = value.charCodeAt(index);
    let escaped: string | undefined;

    switch (codeUnit) {
      case 0x08:
        escaped = '\\b';
        break;
      case 0x09:
        escaped = '\\t';
        break;
      case 0x0a:
        escaped = '\\n';
        break;
      case 0x0c:
        escaped = '\\f';
        break;
      case 0x0d:
        escaped = '\\r';
        break;
      case 0x22:
        escaped = '\\"';
        break;
      case 0x5c:
        escaped = '\\\\';
        break;
      default:
        if (codeUnit < 0x20 || (codeUnit >= 0xd800 && codeUnit <= 0xdfff)) {
          const isSurrogatePair =
            codeUnit >= 0xd800 &&
            codeUnit <= 0xdbff &&
            index + 1 < value.length &&
            value.charCodeAt(index + 1) >= 0xdc00 &&
            value.charCodeAt(index + 1) <= 0xdfff;
          if (isSurrogatePair) {
            index += 1;
          } else {
            escaped = `\\u${codeUnit.toString(16).padStart(4, '0')}`;
          }
        }
    }

    if (escaped !== undefined) {
      if (runStart < index) builder.append(value.slice(runStart, index));
      builder.append(escaped);
      runStart = index + 1;
      continue;
    }

    // Flush safe text in small chunks so a huge JSON string never becomes a huge
    // temporary slice before the configured output limit is reached.
    if (index - runStart + 1 >= Math.min(1024, builder.remaining)) {
      builder.append(value.slice(runStart, index + 1));
      runStart = index + 1;
    }
  }

  if (!builder.isFull && runStart < value.length) builder.append(value.slice(runStart));
  if (!builder.isFull) builder.append('"');
}

function appendBoundedJsonValue(builder: BoundedTextBuilder, value: unknown, seen: WeakSet<object>): boolean {
  if (builder.isFull) return true;
  if (value === null) {
    builder.append('null');
    return true;
  }
  if (typeof value === 'string') {
    appendBoundedJsonString(builder, value);
    return true;
  }
  if (typeof value === 'number') {
    builder.append(Number.isFinite(value) ? String(value) : 'null');
    return true;
  }
  if (typeof value === 'boolean') {
    builder.append(String(value));
    return true;
  }
  if (typeof value !== 'object' || seen.has(value)) return false;

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      builder.append('[');
      for (let index = 0; index < value.length && !builder.isFull; index += 1) {
        if (index > 0) builder.append(',');
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) {
          builder.append('null');
          continue;
        }
        if (!('value' in descriptor) || !appendBoundedJsonValue(builder, descriptor.value, seen)) return false;
      }
      if (!builder.isFull) builder.append(']');
      return true;
    }

    builder.append('{');
    let hasEntry = false;
    for (const key in value) {
      if (builder.isFull) break;
      if (!Object.hasOwn(value, key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      if (!('value' in descriptor)) return false;
      if (hasEntry) builder.append(',');
      appendBoundedJsonString(builder, key);
      builder.append(':');
      if (!appendBoundedJsonValue(builder, descriptor.value, seen)) return false;
      hasEntry = true;
    }
    if (!builder.isFull) builder.append('}');
    return true;
  } finally {
    seen.delete(value);
  }
}

function boundedJsonStringify(value: unknown, maxCodeUnits: number | undefined): string | null {
  if (maxCodeUnits === undefined) return safeJsonStringify(value);
  const builder = new BoundedTextBuilder(maxCodeUnits);
  return appendBoundedJsonValue(builder, value, new WeakSet<object>()) ? builder.toString() : null;
}

function visitModelOutputNode(traversal: ModelOutputTraversal): boolean {
  if (traversal.nodes >= MAX_MODEL_OUTPUT_TRAVERSAL_NODES) {
    traversal.exhausted = true;
    return false;
  }
  traversal.nodes += 1;
  return true;
}

function isBoundedJsonValue(value: unknown, traversal: ModelOutputTraversal): boolean {
  if (!visitModelOutputNode(traversal)) return false;
  const valueType = typeof value;
  if (value === null || valueType === 'string' || valueType === 'number' || valueType === 'boolean') return true;
  if (typeof value !== 'object' || traversal.seen.has(value) || traversal.depth >= MAX_MODEL_OUTPUT_TRAVERSAL_DEPTH) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const ownToJSON = Object.getOwnPropertyDescriptor(value, 'toJSON');
  const inheritedToJSON = prototype && Object.getOwnPropertyDescriptor(prototype, 'toJSON');
  if (
    (ownToJSON && (!('value' in ownToJSON) || typeof ownToJSON.value === 'function')) ||
    (inheritedToJSON && (!('value' in inheritedToJSON) || typeof inheritedToJSON.value === 'function'))
  )
    return false;

  traversal.seen.add(value);
  traversal.depth += 1;
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) {
          if (!visitModelOutputNode(traversal)) return false;
          continue;
        }
        if (!('value' in descriptor) || !isBoundedJsonValue(descriptor.value, traversal)) return false;
      }
      return true;
    }

    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      if (!('value' in descriptor) || !isBoundedJsonValue(descriptor.value, traversal)) return false;
    }
    return true;
  } finally {
    traversal.depth -= 1;
    traversal.seen.delete(value);
  }
}

/**
 * Convert supported model-facing tool output into text without serializing media or unknown objects.
 *
 * The recognized object shapes mirror LanguageModelV2ToolResultOutput. Primitive and array handling
 * remain for backwards compatibility with existing ToolCallFilter callers that stored legacy output.
 */
function modelOutputToText(
  modelOutput: unknown,
  maxTextCodeUnits?: number,
  traversal: ModelOutputTraversal = {
    seen: new WeakSet<object>(),
    depth: 0,
    nodes: 0,
    exhausted: false,
  },
): string | null {
  if (!visitModelOutputNode(traversal)) return null;

  if (typeof modelOutput === 'string') {
    return maxTextCodeUnits === undefined ? modelOutput : modelOutput.slice(0, maxTextCodeUnits);
  }

  if (typeof modelOutput === 'bigint') {
    return maxTextCodeUnits === undefined ? String(modelOutput) : null;
  }

  if (typeof modelOutput === 'number' || typeof modelOutput === 'boolean') {
    return String(modelOutput);
  }

  if (!modelOutput || typeof modelOutput !== 'object') {
    return null;
  }

  if (traversal.seen.has(modelOutput) || traversal.depth >= MAX_MODEL_OUTPUT_TRAVERSAL_DEPTH) {
    return null;
  }

  traversal.seen.add(modelOutput);
  traversal.depth += 1;

  try {
    if (Array.isArray(modelOutput)) {
      const lengthProperty = getOwnDataProperty(modelOutput, 'length');
      if (lengthProperty.kind !== 'data' || typeof lengthProperty.value !== 'number') return null;

      const text: string[] = [];
      let textLength = 0;
      for (let index = 0; index < lengthProperty.value; index += 1) {
        const partProperty = getOwnDataProperty(modelOutput, String(index));
        if (partProperty.kind === 'accessor') return null;
        const converted = modelOutputToText(
          partProperty.kind === 'data' ? partProperty.value : undefined,
          maxTextCodeUnits === undefined ? undefined : Math.max(0, maxTextCodeUnits - textLength),
          traversal,
        );
        if (traversal.exhausted) return null;
        if (converted) {
          if (text.length > 0) {
            text.push('\n');
            textLength += 1;
          }
          const remaining = maxTextCodeUnits === undefined ? undefined : Math.max(0, maxTextCodeUnits - textLength);
          const bounded = remaining === undefined ? converted : converted.slice(0, Math.max(0, remaining));
          text.push(bounded);
          textLength += bounded.length;
        }
        if (maxTextCodeUnits !== undefined && textLength >= maxTextCodeUnits) break;
      }
      return text.length > 0 ? text.join('') : null;
    }

    const output = modelOutput as Record<string, unknown>;
    const typeProperty = getOwnDataProperty(output, 'type');
    if (typeProperty.kind === 'accessor') return null;

    switch (typeProperty.kind === 'data' ? typeProperty.value : undefined) {
      case 'text':
      case 'error-text': {
        const valueProperty = getOwnDataProperty(output, 'value');
        if (valueProperty.kind === 'accessor') return null;
        if (valueProperty.kind === 'data' && typeof valueProperty.value === 'string') {
          return maxTextCodeUnits === undefined ? valueProperty.value : valueProperty.value.slice(0, maxTextCodeUnits);
        }

        const textProperty = getOwnDataProperty(output, 'text');
        if (textProperty.kind === 'accessor') return null;
        if (textProperty.kind === 'data' && typeof textProperty.value === 'string') {
          return maxTextCodeUnits === undefined ? textProperty.value : textProperty.value.slice(0, maxTextCodeUnits);
        }
        return null;
      }
      case 'json':
      case 'error-json': {
        const valueProperty = getOwnDataProperty(output, 'value');
        return valueProperty.kind === 'data' && isBoundedJsonValue(valueProperty.value, traversal)
          ? boundedJsonStringify(valueProperty.value, maxTextCodeUnits)
          : null;
      }
      case 'content': {
        const contentValueProperty = getOwnDataProperty(output, 'value');
        if (contentValueProperty.kind !== 'data' || !Array.isArray(contentValueProperty.value)) return null;
        if (!visitModelOutputNode(traversal)) return null;

        const lengthProperty = getOwnDataProperty(contentValueProperty.value, 'length');
        if (lengthProperty.kind !== 'data' || typeof lengthProperty.value !== 'number') return null;

        const text: string[] = [];
        let textLength = 0;
        for (let index = 0; index < lengthProperty.value; index += 1) {
          if (!visitModelOutputNode(traversal)) return null;
          const partProperty = getOwnDataProperty(contentValueProperty.value, String(index));
          if (partProperty.kind === 'accessor') return null;
          const part = partProperty.kind === 'data' ? partProperty.value : undefined;
          if (!part || typeof part !== 'object') continue;
          const contentPart = part as Record<string, unknown>;

          const contentTypeProperty = getOwnDataProperty(contentPart, 'type');
          if (contentTypeProperty.kind === 'accessor') return null;
          if (contentTypeProperty.kind !== 'data' || contentTypeProperty.value !== 'text') continue;

          const textProperty = getOwnDataProperty(contentPart, 'text');
          if (textProperty.kind === 'accessor') return null;
          const contentPartValueProperty = getOwnDataProperty(contentPart, 'value');
          if (contentPartValueProperty.kind === 'accessor') return null;
          const value =
            textProperty.kind === 'data' && typeof textProperty.value === 'string'
              ? textProperty.value
              : contentPartValueProperty.kind === 'data'
                ? contentPartValueProperty.value
                : undefined;
          if (typeof value !== 'string') continue;
          if (text.length > 0) {
            text.push('\n');
            textLength += 1;
          }
          const remaining = maxTextCodeUnits === undefined ? undefined : Math.max(0, maxTextCodeUnits - textLength);
          const bounded = remaining === undefined ? value : value.slice(0, remaining);
          text.push(bounded);
          textLength += bounded.length;
          if (maxTextCodeUnits !== undefined && textLength >= maxTextCodeUnits) break;
        }
        return text.length > 0 ? text.join('') : null;
      }
      default: {
        // Preserve the two legacy wrapper shapes ToolCallFilter already accepted, but never stringify
        // arbitrary objects. This fails closed for media and unknown provider-specific output.
        const textProperty = getOwnDataProperty(output, 'text');
        if (textProperty.kind === 'accessor') return null;
        if (textProperty.kind === 'data' && typeof textProperty.value === 'string') {
          return maxTextCodeUnits === undefined ? textProperty.value : textProperty.value.slice(0, maxTextCodeUnits);
        }
        if (typeProperty.kind === 'missing') {
          const valueProperty = getOwnDataProperty(output, 'value');
          if (valueProperty.kind === 'accessor') return null;
          if (valueProperty.kind === 'data') {
            return modelOutputToText(valueProperty.value, maxTextCodeUnits, traversal);
          }
        }
        return null;
      }
    }
  } finally {
    traversal.depth -= 1;
    traversal.seen.delete(modelOutput);
  }
}

function truncateUtf8(text: string, maxBytes: number | undefined): string | null {
  if (maxBytes === undefined) return text;

  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  if (encoded.byteLength <= maxBytes) return text;

  const suffix = encoder.encode(MODEL_OUTPUT_TRUNCATION_SUFFIX);
  if (suffix.byteLength > maxBytes) return null;

  let prefixEnd = maxBytes - suffix.byteLength;
  while (prefixEnd > 0 && prefixEnd < encoded.byteLength && (encoded[prefixEnd]! & 0xc0) === 0x80) {
    prefixEnd -= 1;
  }

  const prefix = new TextDecoder().decode(encoded.subarray(0, prefixEnd));
  return `${prefix}${MODEL_OUTPUT_TRUNCATION_SUFFIX}`;
}

function getPreservedModelOutputPart(
  part: MastraToolInvocationPart,
  options: NormalizedToolCallFilteringOptions,
): { type: 'text'; text: string } | null {
  if (
    part.toolInvocation.state !== 'result' ||
    (options.preserveModelOutputFor !== 'all' && !options.preserveModelOutputFor.includes(part.toolInvocation.toolName))
  ) {
    return null;
  }

  try {
    const providerMetadataProperty = getOwnDataProperty(part, 'providerMetadata');
    if (
      providerMetadataProperty.kind !== 'data' ||
      !providerMetadataProperty.value ||
      typeof providerMetadataProperty.value !== 'object'
    )
      return null;

    const mastraMetadataProperty = getOwnDataProperty(providerMetadataProperty.value, 'mastra');
    if (
      mastraMetadataProperty.kind !== 'data' ||
      !mastraMetadataProperty.value ||
      typeof mastraMetadataProperty.value !== 'object'
    )
      return null;

    const modelOutputProperty = getOwnDataProperty(mastraMetadataProperty.value, 'modelOutput');
    if (modelOutputProperty.kind !== 'data') return null;

    const maxTextCodeUnits =
      options.maxModelOutputBytes === undefined
        ? undefined
        : Math.min(Number.MAX_SAFE_INTEGER, options.maxModelOutputBytes + 1);
    const text = modelOutputToText(modelOutputProperty.value, maxTextCodeUnits);
    if (!text) return null;

    const boundedText = truncateUtf8(text, options.maxModelOutputBytes);
    if (!boundedText) return null;

    return {
      type: 'text',
      text: `${part.toolInvocation.toolName} result:\n${boundedText}`,
    };
  } catch {
    return null;
  }
}

/**
 * Keep the sealed boundary attached to the retained part at the original
 * boundary when filtering removes the part that carried it. MessageList uses
 * this marker to decide which parts may be appended when a sealed message is
 * re-added.
 */
export function preserveSealedMessageBoundary(
  message: MastraDBMessage,
  parts: MastraDBMessage['content']['parts'],
  retainedBoundaryPart?: MessagePart,
): MastraDBMessage['content']['parts'] {
  if (parts.length === 0) return parts;

  const boundary = getSealedMessageBoundary(message);
  if (!boundary) return parts;

  let targetIndex =
    retainedBoundaryPart === undefined ? parts.indexOf(boundary.part) : parts.indexOf(retainedBoundaryPart);
  if (targetIndex === -1 && retainedBoundaryPart === undefined) {
    for (let originalIndex = boundary.index - 1; originalIndex >= 0; originalIndex -= 1) {
      const retainedIndex = parts.indexOf(getMessageParts(message)[originalIndex]!);
      if (retainedIndex !== -1) {
        targetIndex = retainedIndex;
        break;
      }
    }
  }

  if (targetIndex === -1) {
    return [
      {
        type: 'text',
        text: '',
        metadata: { mastra: { sealedAt: boundary.sealedAt } },
      },
      ...parts,
    ] as MastraDBMessage['content']['parts'];
  }

  const targetPart = parts[targetIndex] as { metadata?: unknown };
  const targetMetadata = targetPart.metadata;
  const targetMastraMetadata =
    targetMetadata && typeof targetMetadata === 'object' && !Array.isArray(targetMetadata)
      ? (targetMetadata as { mastra?: unknown }).mastra
      : undefined;
  if (
    targetMastraMetadata &&
    typeof targetMastraMetadata === 'object' &&
    !Array.isArray(targetMastraMetadata) &&
    (targetMastraMetadata as { sealedAt?: unknown }).sealedAt === boundary.sealedAt
  ) {
    return parts;
  }

  const updatedPart = {
    ...(parts[targetIndex] as object),
    metadata: {
      ...(targetMetadata && typeof targetMetadata === 'object' && !Array.isArray(targetMetadata) ? targetMetadata : {}),
      mastra: {
        ...(targetMastraMetadata && typeof targetMastraMetadata === 'object' && !Array.isArray(targetMastraMetadata)
          ? targetMastraMetadata
          : {}),
        sealedAt: boundary.sealedAt,
      },
    },
  };

  return [
    ...parts.slice(0, targetIndex),
    updatedPart,
    ...parts.slice(targetIndex + 1),
  ] as MastraDBMessage['content']['parts'];
}

/**
 * Extract compact model-output text from completed tool results that the
 * configured raw-tool filter would remove. The returned parts are newly
 * allocated and never retain provider metadata or raw tool payloads.
 */
export function getPreservedModelOutputParts(
  messages: MastraDBMessage[],
  options: ToolCallFilteringOptions | null = {},
): Array<{ type: 'text'; text: string }> {
  const normalizedOptions = normalizeOptions(options);
  const seenToolCallIds = new Set<string>();
  const preservedParts: Array<{ type: 'text'; text: string }> = [];

  for (const message of messages) {
    for (const part of getToolInvocations(message)) {
      if (normalizedOptions.exclude !== 'all' && !normalizedOptions.exclude.includes(part.toolInvocation.toolName)) {
        continue;
      }

      const toolCallId = getToolCallId(part.toolInvocation);
      if (toolCallId && seenToolCallIds.has(toolCallId)) continue;

      const preservedPart = getPreservedModelOutputPart(part, normalizedOptions);
      if (!preservedPart) continue;

      if (toolCallId) seenToolCallIds.add(toolCallId);
      preservedParts.push(preservedPart);
    }
  }

  return preservedParts;
}

function buildContent(
  message: MastraDBMessage,
  parts: MastraDBMessage['content']['parts'],
  toolInvocations: MastraDBMessage['content']['toolInvocations'],
  behavior: ToolCallMessageFilterBehavior,
  retainedBoundaryPart?: MessagePart,
  toolStateFilter?: ToolStateFilter,
): MastraDBMessage['content'] {
  const { toolInvocations: _originalToolInvocations, ...contentWithoutToolInvocations } = message.content;
  const updatedContent: MastraDBMessage['content'] = {
    ...contentWithoutToolInvocations,
    parts: preserveSealedMessageBoundary(message, parts, retainedBoundaryPart),
  };

  if (toolStateFilter) {
    const filteredMetadata = filterToolStateMetadata(contentWithoutToolInvocations.metadata, toolStateFilter);
    if (filteredMetadata !== contentWithoutToolInvocations.metadata) {
      updatedContent.metadata = filteredMetadata;
    }
  }

  if (behavior.stripMessageProviderMetadata) {
    delete updatedContent.providerMetadata;
  }

  if (toolInvocations && toolInvocations.length > 0) {
    updatedContent.toolInvocations = toolInvocations;
  }

  return updatedContent;
}

function filterAllToolCalls(
  messages: MastraDBMessage[],
  options: NormalizedToolCallFilteringOptions,
  preserveToolCallIds: Set<string>,
  behavior: ToolCallMessageFilterBehavior,
): MastraDBMessage[] {
  const toolStateFilter: ToolStateFilter = {
    excludedToolNames: 'all',
    excludedToolCallIds: new Set(),
    preserveToolCallIds,
  };

  return messages
    .map(message => {
      let changed = false;
      const nonToolParts: MastraMessagePart[] = [];
      let retainedBoundaryPart: MessagePart | undefined;
      const sealedBoundaryPart = getSealedMessageBoundary(message)?.part;
      for (const part of getMessageParts(message)) {
        if (part.type !== 'tool-invocation') {
          if (shouldFilterToolStatePart(part, toolStateFilter)) {
            changed = true;
            continue;
          }
          nonToolParts.push(part);
          if (part === sealedBoundaryPart) retainedBoundaryPart = part;
          continue;
        }

        const toolCallId = getToolCallId(part.toolInvocation);
        if (toolCallId && preserveToolCallIds.has(toolCallId)) {
          nonToolParts.push(part);
          if (part === sealedBoundaryPart) retainedBoundaryPart = part;
          continue;
        }

        changed = true;
        const modelOutputPart = getPreservedModelOutputPart(part, options);
        if (modelOutputPart) nonToolParts.push(modelOutputPart);
        if (part === sealedBoundaryPart) {
          retainedBoundaryPart = modelOutputPart ?? nonToolParts.at(-1);
        }
      }

      const originalToolInvocations = getTopLevelToolInvocations(message);
      const filteredToolInvocations = originalToolInvocations.filter(invocation => {
        const toolCallId = getToolCallId(invocation);
        return toolCallId !== undefined && preserveToolCallIds.has(toolCallId);
      });
      changed ||= filteredToolInvocations.length !== originalToolInvocations.length;
      changed ||= filterToolStateMetadata(message.content.metadata, toolStateFilter) !== message.content.metadata;

      if (!changed) return message;

      if (
        nonToolParts.length === 0 &&
        (filteredToolInvocations?.length ?? 0) === 0 &&
        !hasTopLevelTextContent(message)
      ) {
        return null;
      }

      return {
        ...message,
        content: buildContent(
          message,
          nonToolParts,
          filteredToolInvocations,
          behavior,
          retainedBoundaryPart,
          toolStateFilter,
        ),
      };
    })
    .filter((message): message is MastraDBMessage => message !== null);
}

function filterSpecificToolCalls(
  messages: MastraDBMessage[],
  options: NormalizedToolCallFilteringOptions & { exclude: string[] },
  preserveToolCallIds: Set<string>,
  behavior: ToolCallMessageFilterBehavior,
): MastraDBMessage[] {
  const excludedToolCallIds = new Set<string>();

  for (const message of messages) {
    for (const part of getToolInvocations(message)) {
      if (!options.exclude.includes(part.toolInvocation.toolName)) continue;
      const toolCallId = getToolCallId(part.toolInvocation);
      if (toolCallId) excludedToolCallIds.add(toolCallId);
    }
    for (const invocation of getTopLevelToolInvocations(message)) {
      if (!options.exclude.includes(invocation.toolName)) continue;
      const toolCallId = getToolCallId(invocation);
      if (toolCallId) excludedToolCallIds.add(toolCallId);
    }
  }

  const toolStateFilter: ToolStateFilter = {
    excludedToolNames: options.exclude,
    excludedToolCallIds,
    preserveToolCallIds,
  };

  return messages
    .map(message => {
      let changed = false;
      const filteredParts: MastraMessagePart[] = [];
      let retainedBoundaryPart: MessagePart | undefined;
      const sealedBoundaryPart = getSealedMessageBoundary(message)?.part;
      for (const part of getMessageParts(message)) {
        if (part.type !== 'tool-invocation') {
          if (shouldFilterToolStatePart(part, toolStateFilter)) {
            changed = true;
            continue;
          }
          filteredParts.push(part);
          if (part === sealedBoundaryPart) retainedBoundaryPart = part;
          continue;
        }

        const invocation = part.toolInvocation;
        const toolCallId = getToolCallId(invocation);
        if (toolCallId && preserveToolCallIds.has(toolCallId)) {
          filteredParts.push(part);
          if (part === sealedBoundaryPart) retainedBoundaryPart = part;
          continue;
        }

        const shouldExclude =
          options.exclude.includes(invocation.toolName) ||
          (toolCallId !== undefined && excludedToolCallIds.has(toolCallId));
        if (!shouldExclude) {
          filteredParts.push(part);
          continue;
        }

        changed = true;
        const modelOutputPart = getPreservedModelOutputPart(part, options);
        if (modelOutputPart) filteredParts.push(modelOutputPart);
        if (part === sealedBoundaryPart) {
          retainedBoundaryPart = modelOutputPart ?? filteredParts.at(-1);
        }
      }

      const originalToolInvocations = getTopLevelToolInvocations(message);
      const filteredToolInvocations = originalToolInvocations.filter(invocation => {
        const toolCallId = getToolCallId(invocation);
        return (
          (toolCallId !== undefined && preserveToolCallIds.has(toolCallId)) ||
          (!options.exclude.includes(invocation.toolName) &&
            (toolCallId === undefined || !excludedToolCallIds.has(toolCallId)))
        );
      });
      changed ||= filteredToolInvocations.length !== originalToolInvocations.length;
      changed ||= filterToolStateMetadata(message.content.metadata, toolStateFilter) !== message.content.metadata;

      if (!changed) return message;

      if (
        filteredParts.length === 0 &&
        (filteredToolInvocations?.length ?? 0) === 0 &&
        !hasTopLevelTextContent(message)
      ) {
        return null;
      }

      return {
        ...message,
        content: buildContent(
          message,
          filteredParts,
          filteredToolInvocations,
          behavior,
          retainedBoundaryPart,
          toolStateFilter,
        ),
      };
    })
    .filter((message): message is MastraDBMessage => message !== null);
}

export function filterToolCallMessages(
  messages: MastraDBMessage[],
  options: ToolCallFilteringOptions | null = {},
  preserveToolCallIds = new Set<string>(),
  behavior: ToolCallMessageFilterBehavior = {},
): MastraDBMessage[] {
  const normalizedOptions = normalizeOptions(options);
  if (normalizedOptions.exclude === 'all') {
    return filterAllToolCalls(messages, normalizedOptions, preserveToolCallIds, behavior);
  }
  if (normalizedOptions.exclude.length === 0) return messages;
  return filterSpecificToolCalls(
    messages,
    { ...normalizedOptions, exclude: normalizedOptions.exclude },
    preserveToolCallIds,
    behavior,
  );
}
