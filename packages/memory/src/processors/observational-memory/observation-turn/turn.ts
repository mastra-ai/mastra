import type { MastraDBMessage, MastraMessagePart, MessageList } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorContext, ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { omDebug } from '../debug';
import type { ObservationalMemory } from '../observational-memory';
import type { MemoryContextProvider } from '../processor';
import type { ObservationModelContext } from '../types';

import { loadMemoryContextMessages } from './load-memory-context';
import { ObservationStep } from './step';
import type { ObservationTurnHooks, TurnContext, TurnResult } from './types';

function getToolCallId(part: MastraMessagePart): string | undefined {
  return part.type === 'tool-invocation' ? part.toolInvocation?.toolCallId : undefined;
}

function partMatches(left: MastraMessagePart, right: MastraMessagePart): boolean {
  const leftToolCallId = getToolCallId(left);
  const rightToolCallId = getToolCallId(right);
  if (leftToolCallId || rightToolCallId) {
    return leftToolCallId === rightToolCallId;
  }

  if (left.type === 'text' && right.type === 'text') {
    return left.text === right.text;
  }

  return partsAreEqual([left], [right]);
}

function incomingExtendsPrevious(previousParts: MastraMessagePart[], incomingParts: MastraMessagePart[]): boolean {
  if (incomingParts.length < previousParts.length) return false;

  return previousParts.every((part, index) => {
    const incomingPart = incomingParts[index];
    return incomingPart ? partMatches(part, incomingPart) : false;
  });
}

function mergeAssistantParts(
  previousParts: MastraMessagePart[],
  incomingParts: MastraMessagePart[],
): MastraMessagePart[] {
  if (previousParts.length === 0) return [...incomingParts];
  if (incomingParts.length === 0) return [...previousParts];
  if (incomingExtendsPrevious(previousParts, incomingParts)) return [...incomingParts];

  const merged = [...previousParts];
  for (const part of incomingParts) {
    const toolCallId = getToolCallId(part);
    if (toolCallId) {
      const existingToolIndex = merged.findIndex(existing => getToolCallId(existing) === toolCallId);
      if (existingToolIndex === -1) {
        merged.push(part);
      } else {
        merged[existingToolIndex] = part;
      }
      continue;
    }

    if (part.type === 'text') {
      const existingTextIndex = merged.findIndex(existing => existing.type === 'text' && existing.text === part.text);
      if (existingTextIndex === -1) {
        merged.push(part);
      } else {
        merged[existingTextIndex] = part;
      }
      continue;
    }

    const existingPartIndex = merged.findIndex(existing => partMatches(existing, part));
    if (existingPartIndex === -1) {
      merged.push(part);
    } else {
      merged[existingPartIndex] = part;
    }
  }

  return merged;
}

function mergeContentMetadata(
  previous?: MastraDBMessage['content']['metadata'],
  incoming?: MastraDBMessage['content']['metadata'],
): MastraDBMessage['content']['metadata'] | undefined {
  if (!previous && !incoming) return undefined;

  const previousMastra = previous?.mastra as Record<string, unknown> | undefined;
  const incomingMastra = incoming?.mastra as Record<string, unknown> | undefined;
  const metadata = {
    ...(previous ?? {}),
    ...(incoming ?? {}),
  };

  if (previousMastra || incomingMastra) {
    metadata.mastra = {
      ...(previousMastra ?? {}),
      ...(incomingMastra ?? {}),
    };
  }

  return metadata;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map(key => [key, sortJsonValue((value as Record<string, unknown>)[key])]),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(JSON.parse(JSON.stringify(value))));
}

function partsAreEqual(left: MastraMessagePart[], right: MastraMessagePart[]): boolean {
  if (left.length !== right.length) return false;

  try {
    return stableStringify(left) === stableStringify(right);
  } catch {
    return false;
  }
}

/**
 * Represents a single turn in the agent conversation — one user message → agent response cycle.
 *
 * The turn manages record caching, context loading, and step lifecycle.
 * Create via `om.beginTurn(...)`, then call `start()` to load context,
 * `step(n)` to create steps, and `end()` to finalize.
 *
 * @example
 * ```ts
 * const turn = om.beginTurn({ threadId, resourceId, messageList });
 * await turn.start(memory);
 *
 * const step0 = turn.step(0);
 * const ctx = await step0.prepare();
 * // ... agent generates ...
 *
 * const step1 = turn.step(1);  // finalizes step 0
 * const ctx1 = await step1.prepare();
 * // ... agent generates ...
 *
 * await turn.end();  // finalizes last step, cleanup
 * ```
 */
export class ObservationTurn {
  private _record?: ObservationalMemoryRecord;
  private _context?: TurnContext;
  private _currentStep?: ObservationStep;
  private _started = false;
  private _ended = false;

  /** Generation count at turn start — used to detect if reflection happened during the turn. */
  private _generationCountAtStart = -1;

  private _persistedAssistantIds = new Set<string>();
  private _assistantPartsAccumulator = new Map<string, MastraMessagePart[]>();
  private _assistantMessageTemplates = new Map<string, MastraDBMessage>();

  /** Memory context provider — set via start(). Used by steps for beforeBuffer persistence. */
  memory?: MemoryContextProvider;

  /** Optional stream writer for emitting markers. */
  writer?: ProcessorStreamWriter;

  /** Optional request context for observation calls. */
  requestContext?: RequestContext;

  /** Optional observability context for nested OM spans. */
  observabilityContext?: ObservabilityContext;

  /** Optional agent that owns this processor turn. */
  agent?: ProcessorContext['agent'];

  /** Optional signal sender for processor-originated notifications. */
  sendSignal?: (
    signal: Parameters<NonNullable<ProcessorContext['sendSignal']>>[0],
  ) => ReturnType<NonNullable<ProcessorContext['sendSignal']>>;

  /** Current actor model for this step. Updated by the processor before prepare(). */
  actorModelContext?: ObservationModelContext;

  /** Processor-provided hooks for turn/step lifecycle integration. */
  readonly hooks: ObservationTurnHooks;

  constructor(opts: {
    om: ObservationalMemory;
    threadId: string;
    resourceId?: string;
    messageList: MessageList;
    agent?: ProcessorContext['agent'];
    sendSignal?: ProcessorContext['sendSignal'];
    requestContext?: RequestContext;
    observabilityContext?: ObservabilityContext;
    hooks?: ObservationTurnHooks;
  }) {
    this.om = opts.om;
    this.threadId = opts.threadId;
    this.resourceId = opts.resourceId;
    this.messageList = opts.messageList;
    this.agent = opts.agent;
    this.sendSignal = opts.sendSignal;
    this.requestContext = opts.requestContext;
    this.observabilityContext = opts.observabilityContext;
    this.hooks = opts.hooks ?? {};
  }

  readonly om: ObservationalMemory;
  readonly threadId: string;
  readonly resourceId: string | undefined;
  readonly messageList: MessageList;

  /** The current cached record. Refreshed after mutations (activate/observe/reflect). */
  get record(): ObservationalMemoryRecord {
    if (!this._record) throw new Error('Turn not started — call start() first');
    return this._record;
  }

  /** The context loaded during start(). */
  get context(): TurnContext {
    if (!this._context) throw new Error('Turn not started — call start() first');
    return this._context;
  }

  /** The current step, if one exists. */
  get currentStep(): ObservationStep | undefined {
    return this._currentStep;
  }

  addHooks(hooks?: ObservationTurnHooks): void {
    if (!hooks) return;
    Object.assign(this.hooks, hooks);
  }

  /**
   * Load context and cache the record. Call once at the start of the turn.
   *
   * If a MemoryContextProvider is passed, loads historical messages and adds
   * them to the MessageList. Without a provider, only fetches/caches the record.
   */
  async start(memory?: MemoryContextProvider): Promise<TurnContext> {
    if (this._started) throw new Error('Turn already started');
    this._started = true;

    this._record = await this.om.getOrCreateRecord(this.threadId, this.resourceId);
    this._generationCountAtStart = this._record.generationCount;
    this.memory = memory;

    if (memory) {
      const ctx = await loadMemoryContextMessages({
        memory,
        messageList: this.messageList,
        threadId: this.threadId,
        resourceId: this.resourceId,
      });

      this._context = {
        messages: ctx.messages,
        systemMessage: ctx.systemMessage,
        continuation: ctx.continuationMessage,
        otherThreadsContext: ctx.otherThreadsContext,
        record: this._record,
      };
    } else {
      this._context = {
        messages: [],
        systemMessage: undefined,
        continuation: undefined,
        otherThreadsContext: undefined,
        record: this._record,
      };
    }

    return this._context;
  }

  /**
   * Create a step handle. If a previous step exists, it is finalized
   * (its output messages will be saved at the start of the new step's prepare()).
   */
  step(stepNumber: number): ObservationStep {
    if (!this._started) throw new Error('Turn not started — call start() first');
    if (this._ended) throw new Error('Turn already ended');

    this._currentStep = new ObservationStep(this, stepNumber);
    return this._currentStep;
  }

  /**
   * Finalize the turn: save any remaining messages and return the current cached record.
   *
   * When async observation buffering is enabled and there are unobserved messages,
   * a background buffer operation is kicked off so that observations are computed
   * proactively while the agent is idle, rather than waiting for the next turn.
   * The returned record does not wait for that background buffering pass to finish.
   */
  async end(): Promise<TurnResult> {
    if (this._ended) throw new Error('Turn already ended');
    this._ended = true;

    // Save any unsaved messages from the last step
    const unsavedInput = this.messageList.get.input.db();
    const unsavedOutput = this.messageList.get.response.db();
    const unsavedMessages = this.prepareMessagesForTurnEndPersist(unsavedInput, unsavedOutput);
    if (unsavedMessages.length > 0) {
      await this.om.persistMessages(unsavedMessages, this.threadId, this.resourceId);
    }

    // When the agent goes idle, start buffering any unobserved messages in the background.
    // This ensures messages accumulated during the turn are observed proactively
    // rather than waiting for the next turn's step.prepare() to trigger buffering.
    const asyncObservationEnabled = this.om.buffering.isAsyncObservationEnabled();
    const bufferOnIdle = this.om.getObservationConfig().bufferOnIdle;
    if (asyncObservationEnabled && bufferOnIdle) {
      const allMessages = this.messageList.get.all.db();
      const record = this._record!;
      const unobservedMessages = this.om.getUnobservedMessages(allMessages, record);
      if (unobservedMessages.length > 0) {
        void this.om
          .buffer({
            threadId: this.threadId,
            resourceId: this.resourceId,
            messages: unobservedMessages,
            record,
            writer: this.writer,
            agent: this.agent,
            sendSignal: this.sendSignal,
            requestContext: this.requestContext,
            currentModel: this.actorModelContext,
            observabilityContext: this.observabilityContext,
            skipMinimumTokenCheck: true,
          })
          .catch((err: Error) => {
            omDebug(`[OM:turn.end] idle buffer failed: ${err?.message}`);
          });
      }
    }

    return { record: this._record! };
  }

  /**
   * Refresh the cached record from storage. Called internally after mutations.
   * @internal
   */
  async refreshRecord(): Promise<void> {
    this._record = await this.om.getOrCreateRecord(this.threadId, this.resourceId);
  }

  /**
   * Refresh cross-thread context for resource scope. Called per-step.
   * @internal
   */
  async refreshOtherThreadsContext(): Promise<string | undefined> {
    if (this.om.scope === 'resource' && this.resourceId) {
      const otherThreadsContext = await this.om.getOtherThreadsContext(this.resourceId!, this.threadId);
      if (this._context) {
        this._context.otherThreadsContext = otherThreadsContext;
      }
      return otherThreadsContext;
    }
    return this._context?.otherThreadsContext;
  }

  /**
   * Merge same-id assistant snapshots before step-boundary persistence.
   * @internal
   */
  prepareMessagesForStepBoundaryPersist(messages: MastraDBMessage[]): MastraDBMessage[] {
    const preparedMessages: MastraDBMessage[] = [];
    const assistantMessageIndexes = new Map<string, number>();

    for (const message of messages) {
      if (message.role !== 'assistant') {
        preparedMessages.push(message);
        continue;
      }

      const mergedMessage = this.mergeAssistantMessageSnapshot(message);
      this._persistedAssistantIds.add(message.id);

      const existingIndex = assistantMessageIndexes.get(message.id);
      if (existingIndex === undefined) {
        assistantMessageIndexes.set(message.id, preparedMessages.length);
        preparedMessages.push(mergedMessage);
      } else {
        preparedMessages[existingIndex] = mergedMessage;
      }
    }

    return preparedMessages;
  }

  private prepareMessagesForTurnEndPersist(
    unsavedInput: MastraDBMessage[],
    unsavedOutput: MastraDBMessage[],
  ): MastraDBMessage[] {
    if (this._persistedAssistantIds.size === 0) {
      return [...unsavedInput, ...unsavedOutput];
    }

    const passthroughOutput: MastraDBMessage[] = [];

    for (const message of unsavedOutput) {
      if (message.role === 'assistant' && this._persistedAssistantIds.has(message.id)) {
        this.mergeAssistantMessageSnapshot(message);
      } else {
        passthroughOutput.push(message);
      }
    }

    for (const message of this.messageList.get.all.db()) {
      if (message.role === 'assistant' && this._persistedAssistantIds.has(message.id)) {
        const previousParts = this._assistantPartsAccumulator.get(message.id) ?? [];
        const incomingParts = message.content.parts ?? [];

        if (!partsAreEqual(previousParts, incomingParts)) {
          this.mergeAssistantMessageSnapshot(message);
        } else if (!this._assistantMessageTemplates.has(message.id)) {
          this._assistantMessageTemplates.set(message.id, message);
        }
      }
    }

    const mergedAssistantMessages: MastraDBMessage[] = [];
    for (const id of this._persistedAssistantIds) {
      const template = this._assistantMessageTemplates.get(id);
      const parts = this._assistantPartsAccumulator.get(id);
      if (!template || !parts) continue;

      mergedAssistantMessages.push({
        ...template,
        content: {
          ...template.content,
          parts,
        },
      });
    }

    return [...unsavedInput, ...passthroughOutput, ...mergedAssistantMessages];
  }

  private mergeAssistantMessageSnapshot(message: MastraDBMessage): MastraDBMessage {
    const previousTemplate = this._assistantMessageTemplates.get(message.id);
    const previousParts = this._assistantPartsAccumulator.get(message.id) ?? [];
    const parts = mergeAssistantParts(previousParts, message.content.parts ?? []);
    const contentMetadata = mergeContentMetadata(previousTemplate?.content.metadata, message.content.metadata);

    const mergedMessage = {
      ...(previousTemplate ?? message),
      ...message,
      createdAt: previousTemplate?.createdAt ?? message.createdAt,
      content: {
        ...(previousTemplate?.content ?? message.content),
        ...message.content,
        ...(contentMetadata ? { metadata: contentMetadata } : {}),
        parts,
      },
    };

    this._assistantPartsAccumulator.set(message.id, parts);
    this._assistantMessageTemplates.set(message.id, mergedMessage);

    return mergedMessage;
  }
}
