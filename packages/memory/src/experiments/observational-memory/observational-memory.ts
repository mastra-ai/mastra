import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { Processor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import {
  OBSERVER_SYSTEM_PROMPT,
  buildObserverPrompt,
  parseObserverOutput,
  optimizeObservationsForContext,
} from './observer-agent';
import {
  REFLECTOR_SYSTEM_PROMPT,
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
} from './reflector-agent';
import { TokenCounter } from './token-counter';
import type { ObserverConfig, ReflectorConfig, ThresholdRange, ModelSettings, ProviderOptions } from './types';

/**
 * Configuration for ObservationalMemory
 */
export interface ObservationalMemoryConfig {
  /**
   * Storage adapter for persisting observations.
   * Must be a MemoryStorage instance (from MastraStorage.stores.memory).
   */
  storage: MemoryStorage;

  /**
   * Observer configuration
   */
  observer?: ObserverConfig;

  /**
   * Reflector configuration
   */
  reflector?: ReflectorConfig;

  /**
   * Whether to use resource scope (cross-thread memory).
   * If true, observations span all threads for a resource.
   * If false (default), observations are per-thread.
   */
  resourceScope?: boolean;
}

/**
 * Internal resolved config with all defaults applied
 */
interface ResolvedObserverConfig {
  model: string;
  historyThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
}

interface ResolvedReflectorConfig {
  model: string;
  observationThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
}

/**
 * Default configuration values matching the spec
 */
const DEFAULTS = {
  observer: {
    model: 'google/gemini-2.5-flash',
    historyThreshold: 10_000,
    modelSettings: {
      temperature: 0.3,
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 215,
        },
      },
    },
  },
  reflector: {
    model: 'google/gemini-2.5-flash',
    observationThreshold: 30_000,
    modelSettings: {
      temperature: 0.3,
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    },
  },
} as const;

/**
 * ObservationalMemory - A three-agent memory system for long conversations.
 *
 * This processor:
 * 1. On input: Injects observations into context, filters out observed messages
 * 2. On output: Tracks new messages, triggers Observer/Reflector when thresholds hit
 *
 * The Actor (main agent) sees:
 * - Observations (compressed history)
 * - Suggested continuation message
 * - Recent unobserved messages
 *
 * @example
 * ```ts
 * import { ObservationalMemory } from '@mastra/memory/experiments';
 *
 * // Minimal configuration
 * const om = new ObservationalMemory({ storage });
 *
 * // Full configuration
 * const om = new ObservationalMemory({
 *   storage,
 *   observer: {
 *     model: 'google/gemini-2.5-flash',
 *     historyThreshold: 10_000, // or { min: 8_000, max: 15_000 }
 *     bufferEvery: 4_000,
 *     modelSettings: { temperature: 0.3 },
 *   },
 *   reflector: {
 *     model: 'google/gemini-2.5-flash',
 *     observationThreshold: 30_000,
 *     bufferEvery: 15_000,
 *   },
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [om],
 *   outputProcessors: [om],
 * });
 * ```
 */
export class ObservationalMemory implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  private storage: MemoryStorage;
  private tokenCounter: TokenCounter;
  private resourceScope: boolean;
  private observerConfig: ResolvedObserverConfig;
  private reflectorConfig: ResolvedReflectorConfig;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  constructor(config: ObservationalMemoryConfig) {
    this.storage = config.storage;
    this.resourceScope = config.resourceScope ?? false;

    // Resolve observer config with defaults
    this.observerConfig = {
      model: config.observer?.model ?? DEFAULTS.observer.model,
      historyThreshold: config.observer?.historyThreshold ?? DEFAULTS.observer.historyThreshold,
      bufferEvery: config.observer?.bufferEvery,
      modelSettings: {
        temperature: config.observer?.modelSettings?.temperature ?? DEFAULTS.observer.modelSettings.temperature,
        maxOutputTokens:
          config.observer?.modelSettings?.maxOutputTokens ?? DEFAULTS.observer.modelSettings.maxOutputTokens,
      },
      providerOptions: config.observer?.providerOptions ?? DEFAULTS.observer.providerOptions,
    };

    // Resolve reflector config with defaults
    this.reflectorConfig = {
      model: config.reflector?.model ?? DEFAULTS.reflector.model,
      observationThreshold: config.reflector?.observationThreshold ?? DEFAULTS.reflector.observationThreshold,
      bufferEvery: config.reflector?.bufferEvery,
      modelSettings: {
        temperature: config.reflector?.modelSettings?.temperature ?? DEFAULTS.reflector.modelSettings.temperature,
        maxOutputTokens:
          config.reflector?.modelSettings?.maxOutputTokens ?? DEFAULTS.reflector.modelSettings.maxOutputTokens,
      },
      providerOptions: config.reflector?.providerOptions ?? DEFAULTS.reflector.providerOptions,
    };

    this.tokenCounter = new TokenCounter();

    // Validate bufferEvery is less than threshold
    this.validateBufferConfig();
  }

  /**
   * Validate that bufferEvery is less than the threshold
   */
  private validateBufferConfig(): void {
    const observerThreshold = this.getMaxThreshold(this.observerConfig.historyThreshold);
    if (this.observerConfig.bufferEvery && this.observerConfig.bufferEvery >= observerThreshold) {
      throw new Error(
        `observer.bufferEvery (${this.observerConfig.bufferEvery}) must be less than historyThreshold (${observerThreshold})`,
      );
    }

    const reflectorThreshold = this.getMaxThreshold(this.reflectorConfig.observationThreshold);
    if (this.reflectorConfig.bufferEvery && this.reflectorConfig.bufferEvery >= reflectorThreshold) {
      throw new Error(
        `reflector.bufferEvery (${this.reflectorConfig.bufferEvery}) must be less than observationThreshold (${reflectorThreshold})`,
      );
    }
  }

  /**
   * Get the maximum value from a threshold (simple number or range)
   */
  private getMaxThreshold(threshold: number | ThresholdRange): number {
    if (typeof threshold === 'number') {
      return threshold;
    }
    return threshold.max;
  }

  /**
   * Get the minimum value from a threshold (simple number or range)
   */
  private getMinThreshold(threshold: number | ThresholdRange): number {
    if (typeof threshold === 'number') {
      return threshold;
    }
    return threshold.min;
  }

  /**
   * Calculate dynamic threshold based on observation space.
   * When observations are full, use min threshold.
   * When observations have room, use max threshold.
   */
  private calculateDynamicThreshold(
    threshold: number | ThresholdRange,
    currentObservationTokens: number,
    maxObservationTokens: number,
  ): number {
    if (typeof threshold === 'number') {
      return threshold;
    }

    // Calculate how "full" observations are (0 = empty, 1 = full)
    const fullness = Math.min(currentObservationTokens / maxObservationTokens, 1);

    // Interpolate: full observations = min threshold, empty = max threshold
    return Math.round(threshold.max - fullness * (threshold.max - threshold.min));
  }

  /**
   * Get or create the Observer agent
   */
  private getObserverAgent(): Agent {
    if (!this.observerAgent) {
      this.observerAgent = new Agent({
        id: 'observational-memory-observer',
        name: 'Observer',
        instructions: OBSERVER_SYSTEM_PROMPT,
        model: this.observerConfig.model,
      });
    }
    return this.observerAgent;
  }

  /**
   * Get or create the Reflector agent
   */
  private getReflectorAgent(): Agent {
    if (!this.reflectorAgent) {
      this.reflectorAgent = new Agent({
        id: 'observational-memory-reflector',
        name: 'Reflector',
        instructions: REFLECTOR_SYSTEM_PROMPT,
        model: this.reflectorConfig.model,
      });
    }
    return this.reflectorAgent;
  }

  /**
   * Get thread/resource IDs for storage lookup
   */
  private getStorageIds(threadId: string, resourceId?: string): { threadId: string | null; resourceId: string } {
    if (this.resourceScope) {
      return {
        threadId: null,
        resourceId: resourceId ?? threadId,
      };
    }
    return {
      threadId,
      resourceId: resourceId ?? threadId,
    };
  }

  /**
   * Get or create the observational memory record
   */
  private async getOrCreateRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord> {
    const ids = this.getStorageIds(threadId, resourceId);
    let record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);

    if (!record) {
      record = await this.storage.initializeObservationalMemory({
        threadId: ids.threadId,
        resourceId: ids.resourceId,
        scope: this.resourceScope ? 'resource' : 'thread',
        config: {
          observer: this.observerConfig,
          reflector: this.reflectorConfig,
          resourceScope: this.resourceScope,
        },
      });
    }

    return record;
  }

  /**
   * Check if we need to trigger observation.
   * Uses dynamic threshold if range is configured.
   */
  private shouldObserve(messageTokens: number, observationTokens: number = 0): boolean {
    const threshold = this.calculateDynamicThreshold(
      this.observerConfig.historyThreshold,
      observationTokens,
      this.getMaxThreshold(this.reflectorConfig.observationThreshold),
    );
    return messageTokens > threshold;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    const threshold = this.getMaxThreshold(this.reflectorConfig.observationThreshold);
    return observationTokens > threshold;
  }

  /**
   * Get unobserved messages
   */
  private getUnobservedMessages(allMessages: MastraDBMessage[], record: ObservationalMemoryRecord): MastraDBMessage[] {
    const observedSet = new Set([...record.observedMessageIds, ...record.bufferedMessageIds]);

    return allMessages.filter(msg => {
      if (!msg.id) return true;
      return !observedSet.has(msg.id);
    });
  }

  /**
   * Call the Observer agent to extract observations.
   */
  private async callObserver(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
  ): Promise<{ observations: string; suggestedContinuation?: string }> {
    const agent = this.getObserverAgent();
    const prompt = buildObserverPrompt(existingObservations, messagesToObserve);

    const result = await agent.generate(prompt, {
      modelSettings: {
        temperature: this.observerConfig.modelSettings.temperature,
        maxOutputTokens: this.observerConfig.modelSettings.maxOutputTokens,
      },
      providerOptions: this.observerConfig.providerOptions,
    });

    const parsed = parseObserverOutput(result.text);

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
    };
  }

  /**
   * Call the Reflector agent to condense observations.
   * Includes compression validation and retry logic.
   */
  private async callReflector(
    observations: string,
    manualPrompt?: string,
  ): Promise<{ observations: string; suggestedContinuation?: string }> {
    const agent = this.getReflectorAgent();
    const originalTokens = this.tokenCounter.countObservations(observations);

    // First attempt
    let prompt = buildReflectorPrompt(observations, manualPrompt, false);
    let result = await agent.generate(prompt, {
      modelSettings: {
        temperature: this.reflectorConfig.modelSettings.temperature,
        maxOutputTokens: this.reflectorConfig.modelSettings.maxOutputTokens,
      },
      providerOptions: this.reflectorConfig.providerOptions,
    });

    let parsed = parseReflectorOutput(result.text);
    let reflectedTokens = this.tokenCounter.countObservations(parsed.observations);

    // Check if compression was successful
    if (!validateCompression(originalTokens, reflectedTokens)) {
      console.log(
        `[OM] Reflection did not compress (${originalTokens} -> ${reflectedTokens}), retrying with compression guidance`,
      );

      // Retry with compression prompt
      prompt = buildReflectorPrompt(observations, manualPrompt, true);
      result = await agent.generate(prompt, {
        modelSettings: {
          temperature: this.reflectorConfig.modelSettings.temperature,
          maxOutputTokens: this.reflectorConfig.modelSettings.maxOutputTokens,
        },
        providerOptions: this.reflectorConfig.providerOptions,
      });

      parsed = parseReflectorOutput(result.text);
      reflectedTokens = this.tokenCounter.countObservations(parsed.observations);

      // Log result of retry
      if (!validateCompression(originalTokens, reflectedTokens)) {
        console.warn(
          `[OM] Reflection still did not compress after retry (${originalTokens} -> ${reflectedTokens}). ` +
            `This may indicate the observations cannot be further condensed.`,
        );
      } else {
        console.log(`[OM] Compression successful after retry (${originalTokens} -> ${reflectedTokens})`);
      }
    } else {
      console.log(`[OM] Compression successful (${originalTokens} -> ${reflectedTokens})`);
    }

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
    };
  }

  /**
   * Format observations for injection into context.
   * Applies token optimization before presenting to the Actor.
   *
   * In resource scope mode, filters continuity messages to only show
   * the message for the current thread.
   */
  private formatObservationsForContext(
    observations: string,
    suggestedContinuation?: string,
    currentThreadId?: string,
    threadContinuityMessages?: Record<string, string>,
  ): string {
    // Optimize observations to save tokens
    const optimized = optimizeObservationsForContext(observations);

    let content = `<observational_memory>
${optimized}
</observational_memory>`;

    // In resource scope, use per-thread continuity message if available
    let continuityMessage = suggestedContinuation;
    if (this.resourceScope && currentThreadId && threadContinuityMessages?.[currentThreadId]) {
      continuityMessage = threadContinuityMessages[currentThreadId];
    }

    if (continuityMessage) {
      content += `

<continuation_hint>
${continuityMessage}
</continuation_hint>`;
    }

    return content;
  }

  /**
   * Get threadId and resourceId from either RequestContext or MessageList
   */
  private getThreadContext(
    requestContext: ProcessInputArgs['requestContext'],
    messageList: MessageList,
  ): { threadId: string; resourceId?: string } | null {
    // First try RequestContext (set by Memory)
    const memoryContext = requestContext?.get('MastraMemory') as
      | { thread?: { id: string }; resourceId?: string }
      | undefined;

    if (memoryContext?.thread?.id) {
      return {
        threadId: memoryContext.thread.id,
        resourceId: memoryContext.resourceId,
      };
    }

    // Fallback to MessageList's memoryInfo
    const serialized = messageList.serialize();
    if (serialized.memoryInfo?.threadId) {
      return {
        threadId: serialized.memoryInfo.threadId,
        resourceId: serialized.memoryInfo.resourceId,
      };
    }

    return null;
  }

  /**
   * Process input - inject observations and filter messages.
   */
  async processInput(args: ProcessInputArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, messages, requestContext } = args;

    console.log(`[OM processInput] Messages: ${messages.length}`);

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      console.log('[OM processInput] No thread context found, skipping');
      return messageList;
    }

    const { threadId, resourceId } = context;
    console.log(`[OM processInput] Thread: ${threadId}, Resource: ${resourceId}`);

    const record = await this.getOrCreateRecord(threadId, resourceId);
    console.log(
      `[OM processInput] Record found - observations: ${record.activeObservations ? 'YES' : 'NO'}, observedMsgIds: ${record.observedMessageIds.length}`,
    );

    // Inject observations as a system message
    if (record.activeObservations) {
      const observationSystemMessage = this.formatObservationsForContext(
        record.activeObservations,
        record.suggestedContinuation,
        threadId, // Current thread for continuity message filtering
        record.threadContinuityMessages, // Per-thread continuity messages (resource scope)
      );
      console.log(`[OM processInput] Injecting observations (${observationSystemMessage.length} chars)`);
      if (this.resourceScope) {
        console.log(
          `[OM processInput] Resource scope: observations from ${record.observedThreadIds?.length || 0} threads`,
        );
      }
      messageList.addSystem(observationSystemMessage, 'observational-memory');
    }

    // Remove observed messages from context
    const observedIds = [...record.observedMessageIds, ...record.bufferedMessageIds];

    const beforeCount = messageList.get.all.db().length;
    if (observedIds.length > 0) {
      messageList.removeByIds(observedIds);
      const afterCount = messageList.get.all.db().length;
      console.log(
        `[OM processInput] Removed ${beforeCount - afterCount} observed messages (${beforeCount} → ${afterCount})`,
      );
    }

    // Log what agent will actually see
    const finalMessages = messageList.get.all.db();
    console.log(`[OM processInput] Agent will see: observations + ${finalMessages.length} unobserved messages`);

    return messageList;
  }

  /**
   * Process output - track messages and trigger Observer/Reflector.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList> {
    const { messageList, requestContext } = args;

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    const record = await this.getOrCreateRecord(threadId, resourceId);

    const allMessages = messageList.get.all.db();
    const unobservedMessages = this.getUnobservedMessages(allMessages, record);
    const messageTokens = this.tokenCounter.countMessages(unobservedMessages);
    const currentObservationTokens = record.observationTokenCount ?? 0;

    console.log(
      `[OM processOutputResult] Message tokens: ${messageTokens}, Current observation tokens: ${currentObservationTokens}`,
    );
    console.log(
      `[OM processOutputResult] Should observe: ${this.shouldObserve(messageTokens, currentObservationTokens)}`,
    );

    // Check if we need to observe
    if (this.shouldObserve(messageTokens, currentObservationTokens)) {
      const threshold = this.calculateDynamicThreshold(
        this.observerConfig.historyThreshold,
        currentObservationTokens,
        this.getMaxThreshold(this.reflectorConfig.observationThreshold),
      );

      console.log(`[OM] History threshold exceeded (${messageTokens} > ${threshold}), triggering Observer`);

      const messageIdsToObserve = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

      await this.storage.setObservingFlag(record.id, true);

      try {
        // Call Observer agent
        const result = await this.callObserver(record.activeObservations, unobservedMessages);

        console.log(`[OM] Observer returned observations (${result.observations.length} chars)`);

        // In resource scope, add thread header to observations
        let observationsWithHeader = result.observations;
        if (this.resourceScope) {
          observationsWithHeader = `**Thread: ${threadId}**\n\n${result.observations}`;
        }

        // Combine with existing observations
        const newObservations = record.activeObservations
          ? `${record.activeObservations}\n\n${observationsWithHeader}`
          : observationsWithHeader;

        const totalTokenCount = this.tokenCounter.countObservations(newObservations);

        console.log(`[OM] Storing observations: ${totalTokenCount} tokens, ${messageIdsToObserve.length} message IDs`);

        // Update storage
        await this.storage.updateActiveObservations({
          id: record.id,
          observations: newObservations,
          messageIds: messageIdsToObserve,
          tokenCount: totalTokenCount,
          suggestedContinuation: result.suggestedContinuation,
          // Track current thread in resource scope
          currentThreadId: this.resourceScope ? threadId : undefined,
        });

        console.log(`[OM] Observations stored successfully`);

        // Check if we need to reflect
        if (this.shouldReflect(totalTokenCount)) {
          const reflectThreshold = this.getMaxThreshold(this.reflectorConfig.observationThreshold);
          console.log(
            `[OM] Observation threshold exceeded (${totalTokenCount} > ${reflectThreshold}), triggering Reflector`,
          );

          await this.storage.setReflectingFlag(record.id, true);

          try {
            const reflectResult = await this.callReflector(newObservations);
            const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

            await this.storage.createReflectionGeneration({
              currentRecord: {
                ...record,
                activeObservations: newObservations,
                observedMessageIds: [...record.observedMessageIds, ...messageIdsToObserve],
              },
              reflection: reflectResult.observations,
              tokenCount: reflectionTokenCount,
              suggestedContinuation: reflectResult.suggestedContinuation,
            });
          } finally {
            await this.storage.setReflectingFlag(record.id, false);
          }
        }
      } finally {
        await this.storage.setObservingFlag(record.id, false);
      }
    }

    return messageList;
  }

  /**
   * Manually trigger observation.
   */
  async observe(threadId: string, resourceId?: string, _prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);
    console.log(`[OM] Manual observation triggered for ${record.id}`);
    // TODO: Implement manual observation
  }

  /**
   * Manually trigger reflection with optional guidance prompt.
   *
   * @example
   * ```ts
   * // Trigger reflection with specific focus
   * await om.reflect(threadId, resourceId,
   *   "focus on the authentication implementation, only keep minimal details about UI styling"
   * );
   * ```
   */
  async reflect(threadId: string, resourceId?: string, prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);

    if (!record.activeObservations) {
      console.log(`[OM] No observations to reflect on for ${record.id}`);
      return;
    }

    console.log(`[OM] Manual reflection triggered for ${record.id}`);

    await this.storage.setReflectingFlag(record.id, true);

    try {
      const reflectResult = await this.callReflector(record.activeObservations, prompt);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
        suggestedContinuation: reflectResult.suggestedContinuation,
      });

      console.log(`[OM] Manual reflection complete, new generation created`);
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
  }

  /**
   * Get current observations for a thread/resource
   */
  async getObservations(threadId: string, resourceId?: string): Promise<string | undefined> {
    const ids = this.getStorageIds(threadId, resourceId);
    const record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
    return record?.activeObservations;
  }

  /**
   * Get current record for a thread/resource
   */
  async getRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord | null> {
    const ids = this.getStorageIds(threadId, resourceId);
    return this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
  }

  /**
   * Get observation history (previous generations)
   */
  async getHistory(threadId: string, resourceId?: string, limit?: number): Promise<ObservationalMemoryRecord[]> {
    const ids = this.getStorageIds(threadId, resourceId);
    return this.storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId, limit);
  }

  /**
   * Clear all memory for a specific thread/resource
   */
  async clear(threadId: string, resourceId?: string): Promise<void> {
    const ids = this.getStorageIds(threadId, resourceId);
    await this.storage.clearObservationalMemory(ids.threadId, ids.resourceId);
  }

  /**
   * Get the underlying storage adapter
   */
  getStorage(): MemoryStorage {
    return this.storage;
  }

  /**
   * Get the token counter
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  /**
   * Get current observer configuration
   */
  getObserverConfig(): ResolvedObserverConfig {
    return this.observerConfig;
  }

  /**
   * Get current reflector configuration
   */
  getReflectorConfig(): ResolvedReflectorConfig {
    return this.reflectorConfig;
  }
}
