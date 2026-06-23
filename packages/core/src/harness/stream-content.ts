import { createSignal } from '../agent/signals';
import type { AgentSignalContents, AgentSignalInput } from '../agent/signals';
import { getServerSideFallbackInfo } from '../llm/model/server-side-fallback';
import { getTransformedToolPayload, hasTransformedToolPayload } from '../tools/payload-transform';
import type { ToolPayloadTransformPhase } from '../tools/types';
import type { HarnessMessage, HarnessMessageContent, TokenUsage } from './types';

/**
 * Pure transforms that map raw agent-stream chunk payloads into the
 * `HarnessMessage` / `HarnessMessageContent` shapes a Session renders. They hold
 * no Harness or Session state, so they live in their own module and are shared
 * by the run engine (which folds chunks into messages) and the Harness signal
 * paths (which surface signals as messages).
 */

export function getDisplayTransform(metadata: unknown, phase: ToolPayloadTransformPhase, fallback: unknown) {
  const transform = getTransformedToolPayload(metadata, 'display', phase);
  return hasTransformedToolPayload(transform) ? transform.transformed : fallback;
}

export function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getRecordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function signalContentsToHarnessContent(contents: AgentSignalContents): HarnessMessageContent[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  return contents.flatMap((part): HarnessMessageContent[] => {
    if (part.type === 'text') {
      return [{ type: 'text', text: part.text }];
    }
    if (typeof part.data !== 'string') return [];
    if (part.mediaType.startsWith('image/')) {
      return [{ type: 'image', data: part.data, mimeType: part.mediaType }];
    }
    return [
      {
        type: 'file',
        data: part.data,
        mediaType: part.mediaType,
        filename: part.filename,
      },
    ];
  });
}

export function toSystemReminderContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'system_reminder' }> | undefined {
  const attributes = getRecordValue(payload.attributes);
  const metadata = getRecordValue(payload.metadata);
  const message = signalContentsToText(payload.contents);
  if (!message) return undefined;

  return {
    type: 'system_reminder',
    message,
    reminderType:
      getStringValue(payload.reminderType) ?? getStringValue(attributes?.type) ?? getStringValue(payload.type),
    path: getStringValue(payload.path) ?? getStringValue(attributes?.path),
    precedesMessageId: getStringValue(payload.precedesMessageId) ?? getStringValue(attributes?.precedesMessageId),
    gapText: getStringValue(payload.gapText) ?? getStringValue(attributes?.gapText),
    gapMs:
      typeof payload.gapMs === 'number'
        ? payload.gapMs
        : typeof attributes?.gapMs === 'number'
          ? attributes.gapMs
          : undefined,
    timestamp: getStringValue(payload.timestamp) ?? getStringValue(attributes?.timestamp),
    goalMaxTurns:
      typeof payload.goalMaxTurns === 'number'
        ? payload.goalMaxTurns
        : typeof metadata?.goalMaxTurns === 'number'
          ? metadata.goalMaxTurns
          : undefined,
    judgeModelId: getStringValue(payload.judgeModelId) ?? getStringValue(metadata?.judgeModelId),
    goalEvaluation: getRecordValue(metadata?.goalEvaluation) as
      | Extract<HarnessMessageContent, { type: 'system_reminder' }>['goalEvaluation']
      | undefined,
  };
}

export function toUserSignalMessage(payload: Record<string, unknown>): HarnessMessage | undefined {
  const id = getStringValue(payload.id);
  const rawContents = payload.contents;
  if (!id || rawContents === undefined) return undefined;

  const signal = createSignal({
    id,
    type: 'user',
    tagName: 'user',
    contents: rawContents as AgentSignalContents,
    attributes: getRecordValue(payload.attributes) as AgentSignalInput['attributes'],
    createdAt: getStringValue(payload.createdAt),
  });
  const content = signalContentsToHarnessContent(signal.contents);
  if (content.length === 0) return undefined;

  return {
    id: signal.id,
    role: 'user',
    content,
    createdAt: signal.createdAt,
    attributes: signal.attributes,
  };
}

export function signalContentsToText(contents: unknown): string {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';
  return contents
    .filter((part): part is { type: 'text'; text: string } => getRecordValue(part)?.type === 'text')
    .map(part => part.text)
    .join('\n');
}

export function toStateSignalContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'state_signal' }> | undefined {
  const stateMetadata = getRecordValue(getRecordValue(payload.metadata)?.state);
  const stateId = getStringValue(stateMetadata?.id) ?? getStringValue(payload.tagName) ?? 'state';

  return {
    type: 'state_signal',
    id: getStringValue(payload.id),
    stateId,
    mode: stateMetadata?.mode === 'delta' ? 'delta' : 'snapshot',
    cacheKey: getStringValue(stateMetadata?.cacheKey),
    version: typeof stateMetadata?.version === 'number' ? stateMetadata.version : undefined,
    message: signalContentsToText(payload.contents),
  };
}

export function toNotificationSummaryContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'notification_summary' }> | undefined {
  const metadataSummary = getRecordValue(getRecordValue(payload.metadata)?.notificationSummary);
  const bySource = getRecordValue(metadataSummary?.bySource) ?? {};
  const byPriority = getRecordValue(metadataSummary?.byPriority) ?? {};
  const notificationIds = Array.isArray(metadataSummary?.notificationIds)
    ? metadataSummary.notificationIds.filter((id): id is string => typeof id === 'string')
    : [];
  const pending = typeof metadataSummary?.pending === 'number' ? metadataSummary.pending : undefined;

  return {
    type: 'notification_summary',
    id: getStringValue(payload.id),
    message: signalContentsToText(payload.contents),
    pending: pending ?? notificationIds.length,
    bySource: Object.fromEntries(
      Object.entries(bySource).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ),
    byPriority: Object.fromEntries(
      Object.entries(byPriority).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ),
    notificationIds,
  };
}

export function toReactiveSignalContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'reactive_signal' }> | undefined {
  const tagName = getStringValue(payload.tagName);
  if (!tagName) return undefined;

  return {
    type: 'reactive_signal',
    id: getStringValue(payload.id),
    tagName,
    message: signalContentsToText(payload.contents),
    attributes: getRecordValue(payload.attributes),
    metadata: getRecordValue(payload.metadata),
  };
}

export function toNotificationContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'notification' }> | undefined {
  const attributes = getRecordValue(payload.attributes) ?? {};
  const metadata = getRecordValue(payload.metadata) ?? {};
  const notificationMetadata = getRecordValue(metadata.notification);
  const message = signalContentsToText(payload.contents);
  if (!message) return undefined;

  return {
    type: 'notification',
    id: getStringValue(payload.id),
    notificationId: getStringValue(attributes.id) ?? getStringValue(notificationMetadata?.recordId),
    message,
    source: getStringValue(attributes.source) ?? getStringValue(notificationMetadata?.source),
    kind:
      getStringValue(attributes.kind) ?? getStringValue(attributes.type) ?? getStringValue(notificationMetadata?.kind),
    priority: getStringValue(attributes.priority) ?? getStringValue(notificationMetadata?.priority),
    status: getStringValue(attributes.status) ?? getStringValue(notificationMetadata?.status),
    attributes,
    metadata,
  };
}

/**
 * Map a non-success terminal finish reason (content-filter, error, length) to a
 * user-facing message, or `undefined` for success reasons. A non-success finish
 * must surface as an explicit terminal error rather than a silent `complete`.
 */
export function describeNonSuccessFinishReason(reason: string, providerMetadata: unknown): string | undefined {
  switch (reason) {
    case 'content-filter': {
      const stopDetails = (providerMetadata as { anthropic?: { stopDetails?: Record<string, unknown> } } | undefined)
        ?.anthropic?.stopDetails;
      const explanation =
        stopDetails && typeof stopDetails.explanation === 'string' ? stopDetails.explanation : undefined;
      const category = stopDetails && typeof stopDetails.category === 'string' ? stopDetails.category : undefined;
      const detail = explanation ?? (category ? `category: ${category}` : undefined);
      return detail ? `The model stopped on a content filter (${detail}).` : 'The model stopped on a content filter.';
    }
    case 'error':
      return 'The model stream ended with an error before producing a final response.';
    case 'length':
      return 'The model stopped because it reached its maximum output length before finishing.';
    default:
      return undefined;
  }
}

/**
 * Build a user-facing notice when a turn was served by an Anthropic server-side
 * fallback model instead of the primary model. Without a notice the user has no
 * way to tell the response did not come from the model they selected.
 */
export function describeServerSideFallback(providerMetadata: unknown): string | undefined {
  const fallback = getServerSideFallbackInfo(providerMetadata);
  if (!fallback) {
    return undefined;
  }
  return fallback.model
    ? `The selected model declined this turn; the response was generated by fallback model ${fallback.model}.`
    : 'The selected model declined this turn; the response was generated by a fallback model.';
}

/** Coerce a usage field to a finite number, accepting numeric strings. */
export function getUsageNumber(usage: Record<string, unknown>, key: string): number | undefined {
  const value = usage[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return undefined;
}

/** Fold an optional usage field into a tally when present. */
export function addOptionalUsageField(
  usage: TokenUsage,
  key: keyof Pick<TokenUsage, 'reasoningTokens' | 'cachedInputTokens' | 'cacheCreationInputTokens'>,
  value: number | undefined,
): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}
