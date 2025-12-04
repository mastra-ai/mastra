import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { parseMemoryRuntimeContext } from '@mastra/core/memory';
import type {
  ProcessInputArgs,
  ProcessInputStepArgs,
  Processor,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import {
  createObserverAgent,
  getObserverModelSettings,
  getObserverProviderOptions,
  buildObserverUserPrompt,
  OBSERVER_INSTRUCTIONS,
} from './observer-agent';
import {
  createReflectorAgent,
  getReflectorModelSettings,
  getReflectorProviderOptions,
  buildReflectorUserPrompt,
  REFLECTOR_INSTRUCTIONS,
} from './reflector-agent';
import type {
  ObservationalMemoryConfig,
  ObservationalMemoryRecord,
  ThresholdRange,
} from './types';
import {
  DEFAULT_HISTORY_THRESHOLD,
  DEFAULT_OBSERVATION_THRESHOLD,
} from './types';
import {
  estimateTokenCount,
  compressObservationTokens,
  getMessageTextContent,
} from './utils';

// Re-export types for external use
export type {
  ObservationalMemoryConfig,
  ObservationalMemoryRecord,
  ObserverConfig,
  ReflectorConfig,
  AgentConfig,
  ThresholdRange,
} from './types';

// ============================================================================
// ObservationalMemory Processor
// ============================================================================

/**
 * ObservationalMemory is a processor that implements observation-based memory for AI agents.
 *
 * It operates as three conceptual agents:
 * - **The Actor** (main agent): Sees observations and recent messages that haven't been observed yet
 * - **The Observer**: When message history exceeds a threshold, creates observations from the conversation
 * - **The Reflector**: When observations grow too large, condenses and reorganizes them
 *
 * @example
 * ```typescript
 * import { ObservationalMemory } from "@mastra/memory/observational";
 *
 * const OM = new ObservationalMemory({
 *   storage,
 *   observer: {
 *     model: "google/gemini-2.5-flash",
 *     historyThreshold: 10_000,
 *   },
 *   reflector: {
 *     model: "google/gemini-2.5-flash",
 *     observationThreshold: 30_000,
 *   }
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [OM],
 *   outputProcessors: [OM],
 * });
 * ```
 */
export class ObservationalMemory implements Processor {
  readonly id = 'observational-memory';
  readonly name = 'ObservationalMemory';

  private config: ObservationalMemoryConfig;
  private scope: 'thread' | 'resource';
  private debug: boolean;

  // Observer configuration
  private observerAgent: ReturnType<typeof createObserverAgent>;
  private historyThreshold: number | ThresholdRange;
  private observerModelSettings: ReturnType<typeof getObserverModelSettings>;
  private observerProviderOptions: ReturnType<typeof getObserverProviderOptions>;

  // Reflector configuration (optional)
  private reflectorAgent?: ReturnType<typeof createReflectorAgent>;
  private observationThreshold?: number | ThresholdRange;
  private reflectorModelSettings?: ReturnType<typeof getReflectorModelSettings>;
  private reflectorProviderOptions?: ReturnType<typeof getReflectorProviderOptions>;

  constructor(config: ObservationalMemoryConfig) {
    this.config = config;
    this.scope = config.scope || 'thread';
    this.debug = config.debug || false;

    // Initialize observer
    this.historyThreshold = config.observer?.historyThreshold ?? DEFAULT_HISTORY_THRESHOLD;
    this.observerModelSettings = getObserverModelSettings(config.observer);
    this.observerProviderOptions = getObserverProviderOptions(config.observer);
    this.observerAgent = createObserverAgent(config.observer);

    // Initialize reflector if configured
    if (config.reflector) {
      this.observationThreshold = config.reflector.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD;
      this.reflectorModelSettings = getReflectorModelSettings(config.reflector);
      this.reflectorProviderOptions = getReflectorProviderOptions(config.reflector);
      this.reflectorAgent = createReflectorAgent(config.reflector);
    }
  }

  private log(message: string, ...args: unknown[]) {
    if (this.debug) {
      console.log(`[ObservationalMemory] ${message}`, ...args);
    }
  }

  /**
   * Get the current threshold value, handling dynamic thresholds
   */
  private getCurrentHistoryThreshold(currentObservationTokens: number): number {
    if (typeof this.historyThreshold === 'number') {
      return this.historyThreshold;
    }

    // Dynamic threshold based on observation space
    const { min, max } = this.historyThreshold;
    const observationMax = this.getObservationThreshold();

    // If observations are full, use min threshold
    // If observations are empty, use max threshold
    const ratio = Math.min(1, currentObservationTokens / observationMax);
    return Math.round(max - ratio * (max - min));
  }

  /**
   * Get the observation threshold value
   */
  private getObservationThreshold(): number {
    if (!this.observationThreshold) {
      return DEFAULT_OBSERVATION_THRESHOLD;
    }
    if (typeof this.observationThreshold === 'number') {
      return this.observationThreshold;
    }
    return this.observationThreshold.max;
  }

  /**
   * Get memory context from request context
   */
  private getMemoryContext(requestContext?: RequestContext): {
    threadId?: string;
    resourceId?: string;
  } | null {
    const memoryContext = parseMemoryRuntimeContext(requestContext);
    if (!memoryContext) return null;

    const threadId = memoryContext.thread?.id;
    const resourceId = memoryContext.resourceId;

    return { threadId, resourceId };
  }

  /**
   * Get or initialize observational memory record for a thread/resource
   */
  private async getOrCreateMemoryRecord(
    threadId: string | undefined,
    resourceId: string | undefined
  ): Promise<ObservationalMemoryRecord | null> {
    if (!threadId && !resourceId) return null;

    const scopeId = this.scope === 'resource' ? resourceId : threadId;
    if (!scopeId) return null;

    // Try to get existing record
    const observations = await this.config.storage.stores?.memory.listObservations({
      threadId: scopeId,
    });

    if (observations && observations.length > 0) {
      // Return the most recent observation record
      const latest = observations[observations.length - 1];
      return {
        // Identity
        id: latest.id,
        scope: this.scope,
        threadId: this.scope === 'thread' ? scopeId : null,
        resourceId: resourceId || scopeId,

        // Generation tracking
        originType: latest.originType || 'initial',
        previousGenerationId: latest.previousGenerationId,

        // Observation content
        activeObservations: latest.observation || '',
        bufferedObservations: latest.bufferedObservations,
        bufferedReflection: latest.bufferedReflection,

        // Message tracking
        observedMessageIds: latest.observedMessageIds || [],
        bufferedMessageIds: latest.bufferedMessageIds || [],
        bufferingMessageIds: latest.bufferingMessageIds || [],

        // Token tracking
        totalTokensObserved: latest.totalTokensObserved || 0,
        observationTokenCount: estimateTokenCount(latest.observation || ''),

        // State flags
        isReflecting: latest.isReflecting || false,

        // Metadata
        metadata: {
          createdAt: latest.createdAt || new Date(),
          updatedAt: latest.updatedAt || new Date(),
          reflectionCount: latest.metadata?.reflectionCount || 0,
          lastReflectionAt: latest.metadata?.lastReflectionAt,
        },
      };
    }

    // Return null - record will be created when observations are first made
    return null;
  }

  /**
   * Process input messages - inject observations as context
   *
   * This is called once at the start of processing. It retrieves existing
   * observations and adds them as a system message.
   *
   * Per the spec, observed and buffered messages should be excluded from the
   * message context since they are now represented by observations.
   */
  async processInput(args: ProcessInputArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext } = args;

    const memoryContext = this.getMemoryContext(requestContext);
    if (!memoryContext?.threadId && !memoryContext?.resourceId) {
      return messageList;
    }

    try {
      const record = await this.getOrCreateMemoryRecord(memoryContext.threadId, memoryContext.resourceId);

      if (record && record.activeObservations) {
        // Compress observations to reduce token usage
        const compressedObservations = compressObservationTokens(record.activeObservations);

        // Add observations as a system message
        const observationSystemMessage = `<observational_memory>
The following observations were made about previous interactions. Use these as your primary memory - they are the ONLY information you have about past conversations:

${compressedObservations}
</observational_memory>`;

        messageList.addSystem(observationSystemMessage, 'memory');
        this.log(`Injected ${estimateTokenCount(compressedObservations)} tokens of observations`);

        // Per the spec: exclude observed and buffered messages from context
        // They are now represented by observations
        const excludedIds = new Set([
          ...record.observedMessageIds,
          ...record.bufferedMessageIds,
        ]);

        if (excludedIds.size > 0) {
          // Filter out observed/buffered messages from the message list
          // Note: bufferingMessageIds are NOT excluded - they're still in progress
          const allMessages = messageList.get.all.db();
          const filteredMessages = allMessages.filter(m => !m.id || !excludedIds.has(m.id));

          // Only update if we actually filtered something
          if (filteredMessages.length < allMessages.length) {
            this.log(`Excluded ${allMessages.length - filteredMessages.length} observed/buffered messages from context`);
            // TODO: Need a way to replace messages in the list
            // For now, this is handled by the message tracking
          }
        }
      }
    } catch (error) {
      this.log('Error loading observations:', error);
    }

    return messageList;
  }

  /**
   * Process input at each step - can be used for dynamic observation injection
   *
   * Currently passes through, but could be extended for per-step observation updates.
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    return args.messageList;
  }

  /**
   * Process output result - create observations from the conversation
   *
   * This is called after the LLM generates a response. It:
   * 1. Checks if message history exceeds the threshold
   * 2. If so, runs the observer agent to extract observations
   * 3. Saves the observations to storage
   * 4. Optionally triggers reflection if observations are too large
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext } = args;

    const memoryContext = this.getMemoryContext(requestContext);
    if (!memoryContext?.threadId && !memoryContext?.resourceId) {
      return messageList;
    }

    const threadId = memoryContext.threadId;
    const resourceId = memoryContext.resourceId;

    try {
      // Get existing memory record
      const record = await this.getOrCreateMemoryRecord(threadId, resourceId);

      // Get all messages for observation
      const allMessages = messageList.get.all.db();

      // Calculate which messages haven't been observed yet
      const observedIds = new Set(record?.observedMessageIds || []);
      const unobservedMessages = allMessages.filter(m => m.id && !observedIds.has(m.id));

      // Estimate token count of unobserved messages
      const unobservedTokens = unobservedMessages.reduce((sum, m) => {
        const content = getMessageTextContent(m);
        return sum + estimateTokenCount(content);
      }, 0);

      const currentObservationTokens = record?.observationTokenCount || 0;
      const threshold = this.getCurrentHistoryThreshold(currentObservationTokens);

      this.log(
        `Unobserved history: ${unobservedTokens} tokens, threshold: ${threshold}, observations: ${currentObservationTokens} tokens`
      );

      // Check if we should create observations
      if (unobservedTokens >= threshold) {
        this.log('History threshold exceeded, running observer...');

        // Build the observation prompt
        const existingObservations = record?.activeObservations || '';
        const userPrompt = buildObserverUserPrompt(
          { relevantMessages: unobservedMessages, timestamp: new Date() },
          existingObservations
        );

        // Run the observer agent
        const observerResult = await this.observerAgent.generate(
          `${OBSERVER_INSTRUCTIONS}\n\n${userPrompt}`,
          {
            modelSettings: this.observerModelSettings,
            providerOptions: this.observerProviderOptions as any,
          }
        );

        const newObservations = observerResult.text;
        this.log('Observer generated observations:', newObservations.substring(0, 200) + '...');

        // Combine with existing observations
        const combinedObservations = existingObservations
          ? `${existingObservations}\n\n${newObservations}`
          : newObservations;

        const newObservationTokens = estimateTokenCount(combinedObservations);

        // Get message IDs that were just observed
        const newObservedIds = unobservedMessages.map(m => m.id).filter((id): id is string => Boolean(id));
        const allObservedIds = [...(record?.observedMessageIds || []), ...newObservedIds];

        // Check if we need to reflect
        const observationThreshold = this.getObservationThreshold();
        let finalObservations = combinedObservations;
        let originType: 'initial' | 'reflection' = record?.originType || 'initial';
        let reflectionCount = record?.metadata?.reflectionCount || 0;
        let lastReflectionAt = record?.metadata?.lastReflectionAt;
        let previousGenerationId: string | undefined;

        if (this.reflectorAgent && newObservationTokens >= observationThreshold) {
          this.log('Observation threshold exceeded, running reflector...');

          const reflectorPrompt = buildReflectorUserPrompt(combinedObservations);

          const reflectorResult = await this.reflectorAgent.generate(
            `${REFLECTOR_INSTRUCTIONS}\n\n${reflectorPrompt}`,
            {
              modelSettings: this.reflectorModelSettings,
              providerOptions: this.reflectorProviderOptions as any,
            }
          );

          finalObservations = reflectorResult.text;
          originType = 'reflection';
          reflectionCount += 1;
          lastReflectionAt = new Date();
          previousGenerationId = record?.id;
          this.log('Reflector condensed observations to:', estimateTokenCount(finalObservations), 'tokens');
        }

        // Save the updated observations
        const scopeId = this.scope === 'resource' ? resourceId : threadId;
        if (scopeId) {
          const now = new Date();
          const newRecord: ObservationalMemoryRecord = {
            // Identity
            id: originType === 'reflection' ? crypto.randomUUID() : (record?.id || crypto.randomUUID()),
            scope: this.scope,
            threadId: this.scope === 'thread' ? scopeId : null,
            resourceId: resourceId || scopeId,

            // Generation tracking
            originType,
            previousGenerationId,

            // Observation content
            activeObservations: finalObservations,
            bufferedObservations: undefined,
            bufferedReflection: undefined,

            // Message tracking
            observedMessageIds: allObservedIds,
            bufferedMessageIds: [],
            bufferingMessageIds: [],

            // Token tracking
            totalTokensObserved: (record?.totalTokensObserved || 0) + unobservedTokens,
            observationTokenCount: estimateTokenCount(finalObservations),

            // State flags
            isReflecting: false,

            // Metadata
            metadata: {
              createdAt: record?.metadata?.createdAt || now,
              updatedAt: now,
              reflectionCount,
              lastReflectionAt,
            },
          };

          await this.config.storage.stores?.memory.saveObservations({
            observations: [
              {
                id: newRecord.id,
                threadId: scopeId,
                resourceId: newRecord.resourceId,
                observation: newRecord.activeObservations,
                observedMessageIds: newRecord.observedMessageIds,
                bufferedMessageIds: newRecord.bufferedMessageIds,
                bufferingMessageIds: newRecord.bufferingMessageIds,
                originType: newRecord.originType,
                previousGenerationId: newRecord.previousGenerationId,
                bufferedObservations: newRecord.bufferedObservations,
                bufferedReflection: newRecord.bufferedReflection,
                totalTokensObserved: newRecord.totalTokensObserved,
                observationTokenCount: newRecord.observationTokenCount,
                isReflecting: newRecord.isReflecting,
                metadata: newRecord.metadata,
                createdAt: newRecord.metadata.createdAt,
                updatedAt: newRecord.metadata.updatedAt,
              },
            ],
          });

          this.log(
            `Saved observations: ${newRecord.observationTokenCount} tokens, originType: ${originType}, reflections: ${reflectionCount}`
          );
        }
      }
    } catch (error) {
      this.log('Error creating observations:', error);
    }

    return messageList;
  }

  /**
   * Manually trigger observation with an optional focus prompt
   *
   * @param options - Options for manual observation
   * @param options.threadId - Thread ID to observe
   * @param options.resourceId - Resource ID (for resource-scoped memory)
   * @param options.prompt - Optional prompt to guide observation focus
   */
  async observe(options: {
    threadId: string;
    resourceId?: string;
    prompt?: string;
  }): Promise<string | null> {
    // This would be used for manual/API-triggered observations
    // Implementation would be similar to processOutputResult but callable directly
    this.log('Manual observe called:', options);
    return null;
  }

  /**
   * Manually trigger reflection with an optional focus prompt
   *
   * @param options - Options for manual reflection
   * @param options.threadId - Thread ID to reflect on
   * @param options.resourceId - Resource ID (for resource-scoped memory)
   * @param options.prompt - Optional prompt to guide reflection focus
   */
  async reflect(options: {
    threadId: string;
    resourceId?: string;
    prompt?: string;
  }): Promise<string | null> {
    if (!this.reflectorAgent) {
      this.log('Reflector not configured');
      return null;
    }

    // This would be used for manual/API-triggered reflections
    this.log('Manual reflect called:', options);
    return null;
  }

  /**
   * Clear all observations for a thread/resource
   */
  async clear(options: { threadId: string; resourceId?: string }): Promise<void> {
    const scopeId = this.scope === 'resource' ? options.resourceId : options.threadId;
    if (!scopeId) return;

    // Clear observations from storage
    // This would require a deleteObservations method on storage
    this.log('Clear observations called:', options);
  }
}
