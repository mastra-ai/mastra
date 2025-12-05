import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { Processor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import {
  OBSERVER_SYSTEM_PROMPT,
  buildObserverPrompt,
  parseObserverOutput,
  optimizeObservationsForContext,
  DEFAULT_OBSERVER_CONFIG,
  type ObserverAgentConfig,
} from './observer-agent';
import { TokenCounter } from './token-counter';
import type { ObserverConfig, ReflectorConfig } from './types';

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
  observer?: ObserverConfig & ObserverAgentConfig;

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
 * Default configuration values
 */
const DEFAULTS = {
  observer: {
    historyThreshold: 10000,
    model: 'google:gemini-2.0-flash',
  },
  reflector: {
    observationThreshold: 20000,
    model: 'google:gemini-2.0-flash',
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
 * const om = new ObservationalMemory({
 *   storage: mastra.getStorage().stores.memory,
 *   observer: { historyThreshold: 10000 },
 *   reflector: { observationThreshold: 20000 },
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
  private observerConfig: Required<ObserverConfig> & ObserverAgentConfig;
  private reflectorConfig: Required<ReflectorConfig>;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  constructor(config: ObservationalMemoryConfig) {
    this.storage = config.storage;
    this.resourceScope = config.resourceScope ?? false;

    this.observerConfig = {
      historyThreshold: config.observer?.historyThreshold ?? DEFAULTS.observer.historyThreshold,
      model: config.observer?.model ?? DEFAULTS.observer.model,
      bufferEvery: config.observer?.bufferEvery,
      temperature: config.observer?.temperature ?? DEFAULT_OBSERVER_CONFIG.temperature,
      maxOutputTokens: config.observer?.maxOutputTokens ?? DEFAULT_OBSERVER_CONFIG.maxOutputTokens,
      thinkingBudget: config.observer?.thinkingBudget ?? DEFAULT_OBSERVER_CONFIG.thinkingBudget,
    };

    this.reflectorConfig = {
      observationThreshold: config.reflector?.observationThreshold ?? DEFAULTS.reflector.observationThreshold,
      model: config.reflector?.model ?? DEFAULTS.reflector.model,
      bufferEvery: config.reflector?.bufferEvery,
    };

    this.tokenCounter = new TokenCounter();
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
   */
  private shouldObserve(messageTokens: number): boolean {
    return messageTokens > this.observerConfig.historyThreshold;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    return observationTokens > this.reflectorConfig.observationThreshold;
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
        temperature: this.observerConfig.temperature,
        maxOutputTokens: this.observerConfig.maxOutputTokens,
      },
    });

    const parsed = parseObserverOutput(result.text);

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
    };
  }

  /**
   * Call the Reflector agent to condense observations.
   * TODO: Implement in task 1.4
   */
  private async callReflector(
    _observations: string,
  ): Promise<{ observations: string; suggestedContinuation?: string }> {
    // TODO: Implement actual Reflector agent call in task 1.4
    console.log('[OM] Reflector would be called here');
    return {
      observations: '## Reflected Observations\n\n(Reflector not yet implemented)',
      suggestedContinuation: undefined,
    };
  }

  /**
   * Format observations for injection into context.
   * Applies token optimization before presenting to the Actor.
   */
  private formatObservationsForContext(observations: string, suggestedContinuation?: string): string {
    // Optimize observations to save tokens
    const optimized = optimizeObservationsForContext(observations);

    let content = `<observational_memory>
${optimized}
</observational_memory>`;

    if (suggestedContinuation) {
      content += `

<continuation_hint>
${suggestedContinuation}
</continuation_hint>`;
    }

    return content;
  }

  /**
   * Process input - inject observations and filter messages.
   */
  async processInput(args: ProcessInputArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext } = args;

    const memoryContext = requestContext?.get('MastraMemory') as
      | { thread?: { id: string }; resourceId?: string }
      | undefined;
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;

    if (!threadId) {
      return messageList;
    }

    const record = await this.getOrCreateRecord(threadId, resourceId);

    // Inject observations as a system message
    if (record.activeObservations) {
      const observationSystemMessage = this.formatObservationsForContext(
        record.activeObservations,
        record.suggestedContinuation,
      );
      messageList.addSystem(observationSystemMessage, 'observational-memory');
    }

    // Remove observed messages from context
    const observedIds = [...record.observedMessageIds, ...record.bufferedMessageIds];

    if (observedIds.length > 0) {
      messageList.removeByIds(observedIds);
    }

    return messageList;
  }

  /**
   * Process output - track messages and trigger Observer/Reflector.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList> {
    const { messageList, requestContext } = args;

    const memoryContext = requestContext?.get('MastraMemory') as
      | { thread?: { id: string }; resourceId?: string }
      | undefined;
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;

    if (!threadId) {
      return messageList;
    }

    const record = await this.getOrCreateRecord(threadId, resourceId);

    const allMessages = messageList.get.all.db();
    const unobservedMessages = this.getUnobservedMessages(allMessages, record);
    const messageTokens = this.tokenCounter.countMessages(unobservedMessages);

    // Check if we need to observe
    if (this.shouldObserve(messageTokens)) {
      console.log(
        `[OM] History threshold exceeded (${messageTokens} > ${this.observerConfig.historyThreshold}), triggering Observer`,
      );

      const messageIdsToObserve = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

      await this.storage.setObservingFlag(record.id, true);

      try {
        // Call Observer agent
        const result = await this.callObserver(record.activeObservations, unobservedMessages);

        // Combine with existing observations
        const newObservations = record.activeObservations
          ? `${record.activeObservations}\n\n${result.observations}`
          : result.observations;

        const totalTokenCount = this.tokenCounter.countObservations(newObservations);

        // Update storage
        await this.storage.updateActiveObservations({
          id: record.id,
          observations: newObservations,
          messageIds: messageIdsToObserve,
          tokenCount: totalTokenCount,
          suggestedContinuation: result.suggestedContinuation,
        });

        // Check if we need to reflect
        if (this.shouldReflect(totalTokenCount)) {
          console.log(
            `[OM] Observation threshold exceeded (${totalTokenCount} > ${this.reflectorConfig.observationThreshold}), triggering Reflector`,
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
   * Manually trigger reflection.
   */
  async reflect(threadId: string, resourceId?: string, _prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);
    console.log(`[OM] Manual reflection triggered for ${record.id}`);
    // TODO: Implement manual reflection
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
}
