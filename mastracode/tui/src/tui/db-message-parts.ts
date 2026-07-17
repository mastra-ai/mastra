import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { mastraDBMessageToSignal } from '@mastra/core/signals';
import type { CreatedAgentSignal } from '@mastra/core/signals';

/**
 * DB-native accessors for `MastraDBMessage`.
 *
 * The harness now emits and persists the canonical `MastraDBMessage` shape
 * (`content.format: 2` + nested `content.parts`, `role: 'signal'` for signals)
 * instead of the removed flat `AgentControllerMessage` union. These helpers are
 * the single place mastracode reads that nested shape, so the TUI renderer and
 * the streaming handler share one translation of parts -> render items.
 */

type MessagePart = MastraDBMessage['content']['parts'][number];

export interface TextRenderPart {
  kind: 'text';
  text: string;
}

export interface ThinkingRenderPart {
  kind: 'thinking';
  text: string;
}

export interface ToolRenderPart {
  kind: 'tool';
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
  hasResult: boolean;
  isError: boolean;
}

export interface OmRenderPart {
  kind: 'om';
  event: 'start' | 'end' | 'failed' | 'thread-title';
  operationType: string;
  data: Record<string, unknown>;
}

export type AssistantRenderPart = TextRenderPart | ThinkingRenderPart | ToolRenderPart | OmRenderPart;

function getParts(message: MastraDBMessage): MessagePart[] {
  const content = message.content;
  if (typeof content === 'string' || !content?.parts) return [];
  return content.parts;
}

/** Join the text of all `text` parts on a message (assistant/user), newline-separated. */
export function getMessageText(message: MastraDBMessage): string {
  return getParts(message)
    .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

const OM_EVENT_BY_TYPE: Record<string, OmRenderPart['event']> = {
  'data-om-observation-start': 'start',
  'data-om-observation-end': 'end',
  'data-om-observation-failed': 'failed',
  'data-om-thread-update': 'thread-title',
};

/**
 * Walk a message's `content.parts` and project them into flat render items in
 * document order. Text/reasoning/tool-invocation/data-om-* parts are surfaced;
 * bookkeeping parts (`step-start`, `data-om-status`, etc.) are skipped.
 */
export function getAssistantRenderParts(message: MastraDBMessage): AssistantRenderPart[] {
  const out: AssistantRenderPart[] = [];
  const toolCalls = new Map<string, { toolName: string; args: unknown }>();

  for (const part of getParts(message)) {
    const partType = (part as { type: string }).type;
    switch (partType) {
      case 'text': {
        out.push({ kind: 'text', text: (part as { text: string }).text });
        break;
      }
      case 'reasoning': {
        out.push({ kind: 'thinking', text: (part as { reasoning?: string }).reasoning ?? '' });
        break;
      }
      case 'tool-invocation': {
        const inv = (part as { toolInvocation: Record<string, unknown> }).toolInvocation;
        const hasResult = inv.state === 'result' && inv.result !== undefined;
        out.push({
          kind: 'tool',
          toolCallId: String(inv.toolCallId ?? ''),
          toolName: String(inv.toolName ?? ''),
          args: inv.args,
          result: inv.result,
          hasResult,
          isError: hasResult && (typeof inv.isError === 'boolean' ? inv.isError : isErrorResult(inv.result)),
        });
        break;
      }
      case 'tool-call': {
        const legacyPart = part as { toolCallId?: string; toolName?: string; args?: unknown };
        const toolCallId = String(legacyPart.toolCallId ?? '');
        toolCalls.set(toolCallId, { toolName: String(legacyPart.toolName ?? ''), args: legacyPart.args });
        break;
      }
      case 'tool-result': {
        const legacyPart = part as { toolCallId?: string; toolName?: string; result?: unknown; isError?: boolean };
        const toolCallId = String(legacyPart.toolCallId ?? '');
        const call = toolCalls.get(toolCallId);
        out.push({
          kind: 'tool',
          toolCallId,
          toolName: String(legacyPart.toolName ?? call?.toolName ?? ''),
          args: call?.args,
          result: legacyPart.result,
          hasResult: true,
          isError: legacyPart.isError === true || isErrorResult(legacyPart.result),
        });
        toolCalls.delete(toolCallId);
        break;
      }
      default: {
        const event = OM_EVENT_BY_TYPE[part.type];
        if (event) {
          const data = ((part as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
          out.push({
            kind: 'om',
            event,
            operationType: typeof data.operationType === 'string' ? data.operationType : 'observation',
            data,
          });
        }
        break;
      }
    }
  }

  for (const [toolCallId, call] of toolCalls) {
    out.push({
      kind: 'tool',
      toolCallId,
      toolName: call.toolName,
      args: call.args,
      result: undefined,
      hasResult: false,
      isError: false,
    });
  }

  return out;
}

function isErrorResult(result: unknown): boolean {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const record = result as Record<string, unknown>;
    return record.isError === true || 'error' in record;
  }
  return false;
}

/** A message persisted/streamed as a signal carries `role: 'signal'`. */
export function isSignalMessage(message: MastraDBMessage): boolean {
  return message.role === 'signal';
}

/**
 * Reconstruct the original signal (type, tagName, contents, attributes, metadata)
 * from a `role: 'signal'` `MastraDBMessage`. Delegates to core's canonical
 * reconstruction so mastracode never re-parses `content.metadata.signal` by hand.
 */
export function getSignalView(message: MastraDBMessage): CreatedAgentSignal {
  return mastraDBMessageToSignal(message);
}

export type SignalKind = 'state' | 'reminder' | 'notification-summary' | 'notification' | 'reactive' | 'user';

/**
 * Classify a `role: 'signal'` message into the render branch it drives. Mirrors
 * the dispatch order of the removed core `convertToControllerMessage` signal
 * handling: state -> reminder -> notification-summary -> notification -> reactive -> user.
 */
export function getSignalKind(message: MastraDBMessage): SignalKind {
  const signal = getSignalView(message);
  const { type, tagName } = signal;
  if (type === 'state') return 'state';
  if (type === 'reactive' && tagName === 'system-reminder') return 'reminder';
  if (type === 'notification' && tagName === 'notification-summary') return 'notification-summary';
  if (type === 'notification' && tagName === 'notification') return 'notification';
  if (type === 'reactive') return 'reactive';
  return 'user';
}

function contentsToText(contents: CreatedAgentSignal['contents']): string {
  if (typeof contents === 'string') return contents;
  return contents
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

/** Flatten a signal message's `contents` to plain text (string or text parts). */
export function getSignalContentsText(message: MastraDBMessage): string {
  return contentsToText(getSignalView(message).contents);
}

export interface UserSignalView {
  message: string;
  imageCount: number;
  fileCount: number;
}

/** Fields needed to render a user-kind signal as a user message. */
export function getUserSignalView(message: MastraDBMessage): UserSignalView {
  const contents = getSignalView(message).contents;
  if (typeof contents === 'string') {
    return { message: contents, imageCount: 0, fileCount: 0 };
  }

  let imageCount = 0;
  let fileCount = 0;
  for (const part of contents) {
    if (part.type !== 'file') continue;
    if (part.mediaType.startsWith('image/')) imageCount++;
    else fileCount++;
  }

  return {
    message: contentsToText(contents),
    imageCount,
    fileCount,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export interface ReminderView {
  reminderType?: string;
  path?: string;
  precedesMessageId?: string;
  gapText?: string;
  message: string;
  goalMaxTurns?: number;
  judgeModelId?: string;
  goalEvaluation?: unknown;
}

/**
 * Fields the reminder/judge UI needs, sourced from a `system-reminder` signal.
 * Mirrors the placement the removed core `toSystemReminderContent` helper used:
 * reminder metadata lives under `attributes` (type/path/gapText/precedesMessageId)
 * and `metadata` (goalMaxTurns/judgeModelId/goalEvaluation).
 */
export function getReminderView(message: MastraDBMessage): ReminderView {
  const signal = getSignalView(message);
  const attributes = asRecord(signal.attributes) ?? {};
  const metadata = asRecord(signal.metadata) ?? {};
  return {
    reminderType: asString(attributes.type) ?? asString(signal.type),
    path: asString(attributes.path),
    precedesMessageId: asString(attributes.precedesMessageId),
    gapText: asString(attributes.gapText),
    message: contentsToText(signal.contents),
    goalMaxTurns: asNumber(metadata.goalMaxTurns),
    judgeModelId: asString(metadata.judgeModelId),
    goalEvaluation: metadata.goalEvaluation,
  };
}

/** True for the persisted mirror of a live goal evaluation lifecycle event. */
export function isGoalJudgeEvaluationSignal(message: MastraDBMessage): boolean {
  if (!isSignalMessage(message) || getSignalKind(message) !== 'reminder') return false;
  const reminder = getReminderView(message);
  return reminder.reminderType === 'goal-judge' && reminder.goalEvaluation !== undefined;
}

export interface StateSignalView {
  stateId: string;
  mode: 'snapshot' | 'delta';
  cacheKey?: string;
  version?: number;
  message: string;
}

/** Fields the state-signal UI needs, sourced from a `state` signal's `metadata.state`. */
export function getStateSignalView(message: MastraDBMessage): StateSignalView {
  const signal = getSignalView(message);
  const stateMeta = asRecord(asRecord(signal.metadata)?.state) ?? {};
  return {
    stateId: asString(stateMeta.id) ?? asString(signal.tagName) ?? 'state',
    mode: stateMeta.mode === 'delta' ? 'delta' : 'snapshot',
    cacheKey: asString(stateMeta.cacheKey),
    version: asNumber(stateMeta.version),
    message: contentsToText(signal.contents),
  };
}

export interface ReactiveSignalView {
  tagName?: string;
  message: string;
}

/** Fields the reactive-signal UI needs, sourced from a reactive signal. */
export function getReactiveSignalView(message: MastraDBMessage): ReactiveSignalView {
  const signal = getSignalView(message);
  return {
    tagName: asString(signal.tagName),
    message: contentsToText(signal.contents),
  };
}

export interface NotificationView {
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
}

/** Fields the notification UI needs, sourced from a notification signal's `attributes`/`metadata`. */
export function getNotificationView(message: MastraDBMessage): NotificationView {
  const signal = getSignalView(message);
  const attributes = asRecord(signal.attributes) ?? {};
  const notificationMeta = asRecord(asRecord(signal.metadata)?.notification) ?? {};
  return {
    message: contentsToText(signal.contents),
    source: asString(attributes.source) ?? asString(notificationMeta.source),
    kind: asString(attributes.kind) ?? asString(attributes.type) ?? asString(notificationMeta.kind),
    priority: asString(attributes.priority) ?? asString(notificationMeta.priority),
    status: asString(attributes.status) ?? asString(notificationMeta.status),
  };
}

export interface NotificationSummaryView {
  message: string;
  pending: number;
  bySource: Record<string, number>;
}

/** Fields the notification-summary UI needs, sourced from `metadata.notificationSummary`. */
export function getNotificationSummaryView(message: MastraDBMessage): NotificationSummaryView {
  const signal = getSignalView(message);
  const summary = asRecord(asRecord(signal.metadata)?.notificationSummary) ?? {};
  const bySourceRaw = asRecord(summary.bySource) ?? {};
  const notificationIds = Array.isArray(summary.notificationIds)
    ? summary.notificationIds.filter((id): id is string => typeof id === 'string')
    : [];
  const pending = asNumber(summary.pending);
  return {
    message: contentsToText(signal.contents),
    pending: pending ?? notificationIds.length,
    bySource: Object.fromEntries(
      Object.entries(bySourceRaw).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ),
  };
}
