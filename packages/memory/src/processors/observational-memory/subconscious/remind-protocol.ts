import type { MastraDBMessage } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';

import type { Memory } from '../../..';

export const REMIND_PARENT_THREAD_METADATA_KEY = 'subconsciousRemindParentThreadId';
export const REMIND_PROTOCOL_METADATA_KEY = 'subconsciousRemind';
export const REMIND_DELIVERY_METADATA_KEY = 'subconsciousRemindDelivery';

interface RemindEventBase {
  eventId: string;
  deliveryId: string;
  parentAgentId: string;
  parentThreadId: string;
  resourceId: string;
  createdAt: number;
}

export interface RemindPassiveCheckEvent extends RemindEventBase {
  kind: 'passive-check';
  replyRequired: false;
  candidateIds: string[];
}

export interface RemindQuestionEvent extends RemindEventBase {
  kind: 'question';
  replyId: string;
  replyRequired: true;
}

export interface RemindPartialReplyEvent extends RemindEventBase {
  kind: 'partial-reply';
  replyId: string;
  sequence: number;
  moreComing: true;
}

export interface RemindTerminalPendingEvent extends RemindEventBase {
  kind: 'terminal-pending-delivery';
  replyId: string;
  outcome: RemindTerminalOutcome;
}

export interface RemindTerminalDeliveredEvent extends RemindEventBase {
  kind: 'terminal-delivered';
  replyId: string;
  outcome: RemindTerminalOutcome;
}

export interface RemindContinuationEvent extends RemindEventBase {
  kind: 'continuation';
  outstandingReplyIds: string[];
  attempts: Record<string, number>;
}

export interface RemindRoutingFailureEvent extends RemindEventBase {
  kind: 'routing-failure';
  replyId: string;
  error: string;
}

export interface RemindDeliveryFailureEvent extends RemindEventBase {
  kind: 'delivery-failure';
  replyId: string;
  deliveryKind: 'partial' | 'terminal';
  attempt: number;
  exhausted: boolean;
  error: string;
}

export type RemindTerminalOutcome = 'answer' | 'unable-to-answer' | 'error';

export type RemindProtocolEvent =
  | RemindPassiveCheckEvent
  | RemindQuestionEvent
  | RemindPartialReplyEvent
  | RemindTerminalPendingEvent
  | RemindTerminalDeliveredEvent
  | RemindContinuationEvent
  | RemindRoutingFailureEvent
  | RemindDeliveryFailureEvent;

export function getRemindThreadId(parentThreadId: string): string {
  return `subconscious:${parentThreadId}:remind`;
}

export function isOwnedRemindThread(
  thread: StorageThreadType | null | undefined,
  parentThreadId: string,
  resourceId: string,
): thread is StorageThreadType {
  return thread?.resourceId === resourceId && thread.metadata?.[REMIND_PARENT_THREAD_METADATA_KEY] === parentThreadId;
}

export async function ensureOwnedRemindThread(options: {
  memory: Memory;
  parentThreadId: string;
  resourceId: string;
}): Promise<StorageThreadType> {
  const { memory, parentThreadId, resourceId } = options;
  const threadId = getRemindThreadId(parentThreadId);
  const existing = await memory.getThreadById({ threadId });
  if (existing) {
    if (!isOwnedRemindThread(existing, parentThreadId, resourceId)) {
      throw new Error(`Refusing to use reminder thread ${threadId}: ownership metadata does not match.`);
    }
    return existing;
  }

  await memory.createThread({
    threadId,
    resourceId,
    metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: parentThreadId },
  });
  const created = await memory.getThreadById({ threadId });
  if (!isOwnedRemindThread(created, parentThreadId, resourceId)) {
    throw new Error(`Refusing to use reminder thread ${threadId}: ownership verification failed after creation.`);
  }
  return created;
}

function contentMetadata(message: MastraDBMessage): Record<string, unknown> | undefined {
  return message.content.metadata as Record<string, unknown> | undefined;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasValidAttempts(value: unknown): value is Record<string, number> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([replyId, attempt]) => isString(replyId) && Number.isInteger(attempt) && Number(attempt) >= 0,
    )
  );
}

function hasBaseFields(value: Record<string, unknown>): boolean {
  return (
    isString(value.eventId) &&
    isString(value.deliveryId) &&
    isString(value.parentAgentId) &&
    isString(value.parentThreadId) &&
    isString(value.resourceId) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt)
  );
}

function hasRemindProtocolMetadata(message: MastraDBMessage): boolean {
  return REMIND_PROTOCOL_METADATA_KEY in (contentMetadata(message) ?? {});
}

export function getRemindProtocol(message: MastraDBMessage): RemindProtocolEvent | undefined {
  if (message.role !== 'user') return undefined;
  const value = contentMetadata(message)?.[REMIND_PROTOCOL_METADATA_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const event = value as Record<string, unknown>;
  if (!hasBaseFields(event)) return undefined;

  switch (event.kind) {
    case 'passive-check':
      return event.replyRequired === false && Array.isArray(event.candidateIds) && event.candidateIds.every(isString)
        ? (event as unknown as RemindPassiveCheckEvent)
        : undefined;
    case 'question':
      return event.replyRequired === true && isString(event.replyId)
        ? (event as unknown as RemindQuestionEvent)
        : undefined;
    case 'partial-reply':
      return isString(event.replyId) &&
        Number.isInteger(event.sequence) &&
        Number(event.sequence) > 0 &&
        event.moreComing === true
        ? (event as unknown as RemindPartialReplyEvent)
        : undefined;
    case 'terminal-pending-delivery':
    case 'terminal-delivered':
      return isString(event.replyId) && ['answer', 'unable-to-answer', 'error'].includes(String(event.outcome))
        ? (event as unknown as RemindTerminalPendingEvent | RemindTerminalDeliveredEvent)
        : undefined;
    case 'continuation':
      return Array.isArray(event.outstandingReplyIds) &&
        event.outstandingReplyIds.every(isString) &&
        hasValidAttempts(event.attempts)
        ? (event as unknown as RemindContinuationEvent)
        : undefined;
    case 'routing-failure':
      return isString(event.replyId) && typeof event.error === 'string'
        ? (event as unknown as RemindRoutingFailureEvent)
        : undefined;
    case 'delivery-failure':
      return isString(event.replyId) &&
        (event.deliveryKind === 'partial' || event.deliveryKind === 'terminal') &&
        Number.isInteger(event.attempt) &&
        Number(event.attempt) > 0 &&
        typeof event.exhausted === 'boolean' &&
        typeof event.error === 'string'
        ? (event as unknown as RemindDeliveryFailureEvent)
        : undefined;
    default:
      return undefined;
  }
}

export function isLedgerOnlyRemindEvent(event: RemindProtocolEvent): boolean {
  return event.kind !== 'passive-check' && event.kind !== 'question';
}

export function getRemindMessageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

function getDeliveryEventId(message: MastraDBMessage): string | undefined {
  const metadata = contentMetadata(message);
  const direct = metadata?.[REMIND_DELIVERY_METADATA_KEY];
  const signalMetadata = metadata?.signal;
  const nested =
    signalMetadata && typeof signalMetadata === 'object'
      ? (signalMetadata as { metadata?: Record<string, unknown> }).metadata?.[REMIND_DELIVERY_METADATA_KEY]
      : undefined;
  const value = direct ?? nested;
  if (!value || typeof value !== 'object') return undefined;
  const eventId = (value as { eventId?: unknown }).eventId;
  return typeof eventId === 'string' ? eventId : undefined;
}

export class RemindEventReferenceProcessor implements Processor<'remind-event-reference'> {
  readonly id = 'remind-event-reference';
  readonly name = 'Reminder Event Reference Processor';

  constructor(
    private readonly memory: Memory,
    private readonly threadId: string,
    private readonly resourceId: string,
    private readonly questionToolName?: string,
    private readonly parentAgentId?: string,
  ) {}

  private isTrustedModelEvent(message: MastraDBMessage, protocol: RemindProtocolEvent): boolean {
    return (
      message.threadId === this.threadId &&
      message.resourceId === this.resourceId &&
      protocol.resourceId === this.resourceId &&
      getRemindThreadId(protocol.parentThreadId) === this.threadId &&
      (!this.parentAgentId || protocol.parentAgentId === this.parentAgentId)
    );
  }

  async processInputStep({
    messages,
    tools,
    activeTools,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    const references = messages.flatMap(message => {
      const eventId = getDeliveryEventId(message);
      return eventId ? [{ message, eventId }] : [];
    });
    const canonicalById = new Map(
      messages
        .filter(message => {
          const protocol = getRemindProtocol(message);
          return protocol && !isLedgerOnlyRemindEvent(protocol) && this.isTrustedModelEvent(message, protocol);
        })
        .map(message => [message.id, message]),
    );
    const missingIds = references.map(reference => reference.eventId).filter(eventId => !canonicalById.has(eventId));
    if (missingIds.length > 0) {
      const store = await this.memory.storage.getStore('memory');
      const stored = await store?.listMessagesById({ messageIds: [...new Set(missingIds)] });
      for (const message of stored?.messages ?? []) {
        const protocol = getRemindProtocol(message);
        if (!protocol || !this.isTrustedModelEvent(message, protocol)) continue;
        if (!isLedgerOnlyRemindEvent(protocol)) {
          canonicalById.set(message.id, message);
        } else if (protocol.kind === 'continuation') {
          canonicalById.set(message.id, {
            id: `${protocol.deliveryId}:model`,
            role: 'user',
            threadId: this.threadId,
            resourceId: this.resourceId,
            createdAt: new Date(protocol.createdAt),
            content: {
              format: 2,
              parts: [
                {
                  type: 'text',
                  text: getRemindMessageText(message),
                },
              ],
              metadata: { [REMIND_DELIVERY_METADATA_KEY]: { eventId: protocol.eventId } },
            },
          });
        }
      }
    }

    const referenceIds = new Set(references.map(reference => reference.message.id));
    const nextMessages = messages.filter(message => {
      if (referenceIds.has(message.id)) return false;
      const protocol = getRemindProtocol(message);
      if (!protocol) return !hasRemindProtocolMetadata(message);
      return !isLedgerOnlyRemindEvent(protocol) && this.isTrustedModelEvent(message, protocol);
    });
    for (const { eventId } of references) {
      if (!nextMessages.some(message => message.id === eventId)) {
        const canonical = canonicalById.get(eventId);
        if (!canonical) throw new Error(`Reminder event ${eventId} could not be resolved from canonical storage.`);
        nextMessages.push(canonical);
      }
    }

    const hasTrustedQuestion = nextMessages.some(message => getRemindProtocol(message)?.kind === 'question');
    const restrictedActiveTools =
      this.questionToolName && !hasTrustedQuestion
        ? (activeTools ?? Object.keys(tools ?? {})).filter(toolName => toolName !== this.questionToolName)
        : undefined;
    const changed = nextMessages.length !== messages.length || references.length > 0;
    return changed || restrictedActiveTools
      ? { messages: nextMessages, activeTools: restrictedActiveTools }
      : undefined;
  }
}
