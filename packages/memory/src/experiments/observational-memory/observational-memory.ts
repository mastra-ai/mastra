import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type {
  Processor,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';

import {
  buildObserverSystemPrompt,
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
import type {
  ObserverConfig,
  ReflectorConfig,
  ThresholdRange,
  ModelSettings,
  ProviderOptions,
  ObservationFocus,
} from './types';

/**
 * Debug event emitted when observation-related events occur.
 * Useful for understanding what the Observer is doing.
 */
export interface ObservationDebugEvent {
  type:
    | 'observation_triggered'
    | 'observation_complete'
    | 'reflection_triggered'
    | 'reflection_complete'
    | 'tokens_accumulated';
  timestamp: Date;
  threadId: string;
  resourceId: string;
  /** Messages that were sent to the Observer */
  messages?: Array<{ role: string; content: string }>;
  /** Token counts */
  pendingTokens?: number;
  sessionTokens?: number;
  totalPendingTokens?: number;
  threshold?: number;
  /** The observations that were generated */
  observations?: string;
  /** Previous observations (before this event) */
  previousObservations?: string;
  /** Observer's raw output */
  rawObserverOutput?: string;
}

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

  /**
   * Debug callback for observation events.
   * Called whenever observation-related events occur.
   * Useful for debugging and understanding the observation flow.
   */
  onDebugEvent?: (event: ObservationDebugEvent) => void;
}

/**
 * Internal resolved config with all defaults applied
 */
interface ResolvedObserverConfig {
  model: MastraModelConfig;
  observationThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
  focus?: ObservationFocus;
}

interface ResolvedReflectorConfig {
  model: MastraModelConfig;
  reflectionThreshold: number | ThresholdRange;
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
    observationThreshold: 10_000,
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
    reflectionThreshold: 30_000,
    modelSettings: {
      temperature: 0, // Use 0 for maximum consistency in reflections
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

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC BUFFERING - DISABLED FOR INITIAL IMPLEMENTATION
// The buffering system is commented out to ensure correctness with a simple
// blocking implementation first. Re-enable once the core logic is verified.
// ═══════════════════════════════════════════════════════════════════════════

// /**
//  * Tracks in-progress async buffering operations
//  */
// interface BufferingOperation {
//   /** Promise that resolves when buffering completes */
//   promise: Promise<void>;
//   /** Token count when buffering started */
//   startedAtTokens: number;
//   /** Timestamp when buffering started */
//   startedAt: Date;
// }

// /** Timeout for waiting on in-progress buffering (ms) */
// const BUFFERING_WAIT_TIMEOUT = 60_000; // 60 seconds

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
 *     observationThreshold: 10_000, // or { min: 8_000, max: 15_000 }
 *     bufferEvery: 4_000,
 *     modelSettings: { temperature: 0.3 },
 *   },
 *   reflector: {
 *     model: 'google/gemini-2.5-flash',
 *     reflectionThreshold: 30_000,
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
  private onDebugEvent?: (event: ObservationDebugEvent) => void;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  // ASYNC BUFFERING DISABLED - See note at top of file
  // /**
  //  * Track in-progress observation buffering per record.
  //  * Key is recordId, value is the buffering operation.
  //  */
  // private observationBuffering: Map<string, BufferingOperation> = new Map();

  // /**
  //  * Track in-progress reflection buffering per record.
  //  * Key is recordId, value is the buffering operation.
  //  */
  // private reflectionBuffering: Map<string, BufferingOperation> = new Map();

  constructor(config: ObservationalMemoryConfig) {
    this.storage = config.storage;
    this.resourceScope = config.resourceScope ?? false;

    // Resolve observer config with defaults
    this.observerConfig = {
      model: config.observer?.model ?? DEFAULTS.observer.model,
      observationThreshold: config.observer?.observationThreshold ?? DEFAULTS.observer.observationThreshold,
      bufferEvery: config.observer?.bufferEvery,
      modelSettings: {
        temperature: config.observer?.modelSettings?.temperature ?? DEFAULTS.observer.modelSettings.temperature,
        maxOutputTokens:
          config.observer?.modelSettings?.maxOutputTokens ?? DEFAULTS.observer.modelSettings.maxOutputTokens,
      },
      providerOptions: config.observer?.providerOptions ?? DEFAULTS.observer.providerOptions,
      focus: config.observer?.focus,
    };

    // Resolve reflector config with defaults
    this.reflectorConfig = {
      model: config.reflector?.model ?? DEFAULTS.reflector.model,
      reflectionThreshold: config.reflector?.reflectionThreshold ?? DEFAULTS.reflector.reflectionThreshold,
      bufferEvery: config.reflector?.bufferEvery,
      modelSettings: {
        temperature: config.reflector?.modelSettings?.temperature ?? DEFAULTS.reflector.modelSettings.temperature,
        maxOutputTokens:
          config.reflector?.modelSettings?.maxOutputTokens ?? DEFAULTS.reflector.modelSettings.maxOutputTokens,
      },
      providerOptions: config.reflector?.providerOptions ?? DEFAULTS.reflector.providerOptions,
    };

    this.tokenCounter = new TokenCounter();
    this.onDebugEvent = config.onDebugEvent;

    // ASYNC BUFFERING DISABLED - validation not needed
    // this.validateBufferConfig();
  }

  /**
   * Emit a debug event if the callback is configured
   */
  private emitDebugEvent(event: ObservationDebugEvent): void {
    if (this.onDebugEvent) {
      this.onDebugEvent(event);
    }
  }

  // ASYNC BUFFERING DISABLED - See note at top of file
  // /**
  //  * Validate that bufferEvery is less than the threshold
  //  */
  // private validateBufferConfig(): void {
  //   const observerThreshold = this.getMaxThreshold(this.observerConfig.observationThreshold);
  //   if (this.observerConfig.bufferEvery && this.observerConfig.bufferEvery >= observerThreshold) {
  //     throw new Error(
  //       `observer.bufferEvery (${this.observerConfig.bufferEvery}) must be less than observationThreshold (${observerThreshold})`,
  //     );
  //   }

  //   const reflectorThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
  //   if (this.reflectorConfig.bufferEvery && this.reflectorConfig.bufferEvery >= reflectorThreshold) {
  //     throw new Error(
  //       `reflector.bufferEvery (${this.reflectorConfig.bufferEvery}) must be less than reflectionThreshold (${reflectorThreshold})`,
  //     );
  //   }
  // }

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
      // Build system prompt with focus configuration
      const systemPrompt = buildObserverSystemPrompt(this.observerConfig.focus);

      this.observerAgent = new Agent({
        id: 'observational-memory-observer',
        name: 'Observer',
        instructions: systemPrompt,
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
      this.observerConfig.observationThreshold,
      observationTokens,
      this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
    );
    return messageTokens > threshold;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    const threshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
    return observationTokens > threshold;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASYNC BUFFERING METHODS - DISABLED FOR INITIAL IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════════════════

  // /**
  //  * Check if we should start buffering observations.
  //  * Returns true if:
  //  * - bufferEvery is configured
  //  * - We've crossed the bufferEvery threshold
  //  * - We haven't crossed the main threshold yet
  //  * - No buffering is already in progress for this record
  //  */
  // private shouldStartObservationBuffering(recordId: string, messageTokens: number, observationTokens: number): boolean {
  //   const bufferEvery = this.observerConfig.bufferEvery;
  //   if (!bufferEvery) return false;

  //   // Check if buffering is already in progress
  //   if (this.observationBuffering.has(recordId)) return false;

  //   // Check if there's already buffered content waiting
  //   // (This would be checked via record.bufferedObservations, but we keep it simple here)

  //   // Check if we've crossed bufferEvery but not the main threshold
  //   const mainThreshold = this.calculateDynamicThreshold(
  //     this.observerConfig.observationThreshold,
  //     observationTokens,
  //     this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
  //   );

  //   return messageTokens >= bufferEvery && messageTokens < mainThreshold;
  // }

  // /**
  //  * Check if we should start buffering reflections.
  //  */
  // private shouldStartReflectionBuffering(recordId: string, observationTokens: number): boolean {
  //   const bufferEvery = this.reflectorConfig.bufferEvery;
  //   if (!bufferEvery) return false;

  //   // Check if buffering is already in progress
  //   if (this.reflectionBuffering.has(recordId)) return false;

  //   // Check if we've crossed bufferEvery but not the main threshold
  //   const mainThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);

  //   return observationTokens >= bufferEvery && observationTokens < mainThreshold;
  // }

  // /**
  //  * Start async observation buffering in the background.
  //  * Does NOT block - returns immediately and runs in background.
  //  */
  // private startObservationBuffering(
  //   record: ObservationalMemoryRecord,
  //   threadId: string,
  //   unobservedMessages: MastraDBMessage[],
  //   currentTokens: number,
  // ): void {
  //   const messageIds = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

  //   console.info(`[OM Buffering] Starting async observation buffering for ${record.id} (${currentTokens} tokens)`);

  //   // Create the async operation
  //   const bufferingPromise = (async () => {
  //     try {
  //       // Mark messages as being buffered
  //       await this.storage.markMessagesAsBuffering(record.id, messageIds);

  //       // Call Observer agent
  //       const result = await this.callObserver(record.activeObservations, unobservedMessages);

  //       // In resource scope, add thread header
  //       let observationsWithHeader = result.observations;
  //       if (this.resourceScope) {
  //         observationsWithHeader = `**Thread: ${threadId}**\n\n${result.observations}`;
  //       }

  //       // Store as buffered (NOT active yet)
  //       await this.storage.updateBufferedObservations({
  //         id: record.id,
  //         observations: observationsWithHeader,
  //         messageIds,
  //         suggestedContinuation: result.suggestedContinuation,
  //       });

  //       console.info(`[OM Buffering] Observation buffering complete for ${record.id}`);
  //     } catch (error) {
  //       console.error(`[OM Buffering] Observation buffering failed for ${record.id}:`, error);
  //       // Clear buffering state on failure
  //       await this.storage.markMessagesAsBuffering(record.id, []);
  //       throw error;
  //     } finally {
  //       // Remove from tracking
  //       this.observationBuffering.delete(record.id);
  //     }
  //   })();

  //   // Track the operation
  //   this.observationBuffering.set(record.id, {
  //     promise: bufferingPromise,
  //     startedAtTokens: currentTokens,
  //     startedAt: new Date(),
  //   });
  // }

  // /**
  //  * Start async reflection buffering in the background.
  //  */
  // private startReflectionBuffering(record: ObservationalMemoryRecord, observations: string): void {
  //   console.info(`[OM Buffering] Starting async reflection buffering for ${record.id}`);

  //   const bufferingPromise = (async () => {
  //     try {
  //       const result = await this.callReflector(observations);

  //       // Store as buffered reflection
  //       await this.storage.updateBufferedReflection(record.id, result.observations);

  //       console.info(`[OM Buffering] Reflection buffering complete for ${record.id}`);
  //     } catch (error) {
  //       console.error(`[OM Buffering] Reflection buffering failed for ${record.id}:`, error);
  //       throw error;
  //     } finally {
  //       this.reflectionBuffering.delete(record.id);
  //     }
  //   })();

  //   this.reflectionBuffering.set(record.id, {
  //     promise: bufferingPromise,
  //     startedAtTokens: record.observationTokenCount,
  //     startedAt: new Date(),
  //   });
  // }

  // /**
  //  * Wait for in-progress buffering with timeout.
  //  */
  // private async waitForBuffering(operation: BufferingOperation, type: 'observation' | 'reflection'): Promise<void> {
  //   const elapsed = Date.now() - operation.startedAt.getTime();
  //   const remaining = BUFFERING_WAIT_TIMEOUT - elapsed;

  //   if (remaining <= 0) {
  //     throw new Error(`[OM] ${type} buffering timeout exceeded (started ${elapsed}ms ago)`);
  //   }

  //   console.info(`[OM] Waiting for in-progress ${type} buffering (max ${remaining}ms)...`);

  //   // Race between the operation and timeout
  //   await Promise.race([
  //     operation.promise,
  //     new Promise<never>((_, reject) =>
  //       setTimeout(() => reject(new Error(`[OM] ${type} buffering wait timeout`)), remaining),
  //     ),
  //   ]);
  // }

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
  ): Promise<{ observations: string; currentTask?: string; suggestedContinuation?: string }> {
    const agent = this.getObserverAgent();
    const prompt = buildObserverPrompt(existingObservations, messagesToObserve);

    const result = await agent.generate(prompt, {
      modelSettings: {
        temperature: this.observerConfig.modelSettings.temperature,
        maxOutputTokens: this.observerConfig.modelSettings.maxOutputTokens,
      },
      providerOptions: this.observerConfig.providerOptions as any,
    });

    const parsed = parseObserverOutput(result.text);

    return {
      observations: parsed.observations,
      currentTask: parsed.currentTask,
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
      providerOptions: this.reflectorConfig.providerOptions as any,
    });

    let parsed = parseReflectorOutput(result.text);
    let reflectedTokens = this.tokenCounter.countObservations(parsed.observations);

    // Check if compression was successful
    if (!validateCompression(originalTokens, reflectedTokens)) {
      console.info(
        `[OM] Reflection did not compress (${originalTokens} -> ${reflectedTokens}), retrying with compression guidance`,
      );

      // Retry with compression prompt
      prompt = buildReflectorPrompt(observations, manualPrompt, true);
      result = await agent.generate(prompt, {
        modelSettings: {
          temperature: this.reflectorConfig.modelSettings.temperature,
          maxOutputTokens: this.reflectorConfig.modelSettings.maxOutputTokens,
        },
        providerOptions: this.reflectorConfig.providerOptions as any,
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
        console.info(`[OM] Compression successful after retry (${originalTokens} -> ${reflectedTokens})`);
      }
    } else {
      console.info(`[OM] Compression successful (${originalTokens} -> ${reflectedTokens})`);
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
  /**
   * Format observations for injection into the Actor's context.
   * @param observations - The observations to inject
   * @param suggestedResponse - Thread-specific suggested response (from thread metadata)
   * @param unobservedContextBlocks - Formatted <unobserved-context> blocks from other threads
   */
  private formatObservationsForContext(
    observations: string,
    suggestedResponse?: string,
    unobservedContextBlocks?: string,
  ): string {
    // Optimize observations to save tokens
    const optimized = optimizeObservationsForContext(observations);

    let content = `<observations>
${optimized}
</observations>`;

    // Add unobserved context from other threads (resource scope only)
    if (unobservedContextBlocks) {
      content += `\n\n${unobservedContextBlocks}`;
    }

    if (suggestedResponse) {
      content += `

<suggested-response>
${suggestedResponse}
</suggested-response>`;
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
   * Process input at each step - inject observations and filter messages.
   * Unlike processInput which runs once, this runs at every step of the agentic loop.
   *
   * - Step 0: Load historical messages + inject observations + filter observed messages
   * - Step N: Re-inject observations + filter any new observed messages (e.g., after tool calls)
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, messages, requestContext, stepNumber, state } = args;

    console.info(`[OM processInputStep] Step ${stepNumber}, Messages: ${messages.length}`);

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      console.info('[OM processInputStep] No thread context found, skipping');
      return messageList;
    }

    const { threadId, resourceId } = context;
    console.info(`[OM processInputStep] Thread: ${threadId}, Resource: ${resourceId}`);

    const record = await this.getOrCreateRecord(threadId, resourceId);
    console.info(
      `[OM processInputStep] Record found - observations: ${record.activeObservations ? 'YES' : 'NO'}, observedMsgIds: ${record.observedMessageIds.length}`,
    );

    // Historical message loading should only happen once per request (on step 0)
    // Use state to track this so we don't re-load on subsequent steps
    let unobservedContextBlocks: string | undefined;

    if (!state.initialSetupDone) {
      state.initialSetupDone = true;

      // Load unobserved messages from storage using cursor-based query
      // In resource scope, this loads messages from ALL threads for the resource
      const lastObservedAt = record.lastObservedAt;
      const historicalMessages = await this.loadUnobservedMessages(threadId, resourceId, lastObservedAt);

      if (historicalMessages.length > 0) {
        console.info(
          `[OM processInputStep] Loaded ${historicalMessages.length} messages since ${lastObservedAt?.toISOString() ?? 'beginning'}`,
        );

        if (this.resourceScope && resourceId) {
          // Resource scope: group messages by thread
          const messagesByThread = this.groupMessagesByThread(historicalMessages);

          // Format other threads' messages as <unobserved-context> blocks
          unobservedContextBlocks = this.formatUnobservedContextBlocks(messagesByThread, threadId);
          if (unobservedContextBlocks) {
            console.info(
              `[OM processInputStep] Including unobserved context from ${messagesByThread.size - 1} other threads`,
            );
          }

          // Store in state so we can access it when injecting observations
          state.unobservedContextBlocks = unobservedContextBlocks;

          // Add only current thread's messages to messageList
          const currentThreadMessages = messagesByThread.get(threadId) || [];
          for (const msg of currentThreadMessages) {
            if (msg.role !== 'system') {
              messageList.add(msg, 'memory');
            }
          }
        } else {
          // Thread scope: add all messages to messageList
          for (const msg of historicalMessages) {
            if (msg.role !== 'system') {
              messageList.add(msg, 'memory');
            }
          }
        }
      }
    } else {
      console.info(`[OM processInputStep] Step ${stepNumber}: skipping historical message load (already done)`);
      // Retrieve unobserved context blocks from state for subsequent steps
      unobservedContextBlocks = state.unobservedContextBlocks as string | undefined;
    }

    // Fetch thread metadata to get suggested response
    const thread = await this.storage.getThreadById({ threadId });
    const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
    const suggestedResponse = threadOMMetadata?.suggestedResponse;

    // Inject observations as a system message (every step)
    // This happens after historical message loading so we have unobservedContextBlocks
    if (record.activeObservations) {
      const observationSystemMessage = this.formatObservationsForContext(
        record.activeObservations,
        suggestedResponse,
        unobservedContextBlocks,
      );
      console.info(`[OM processInputStep] Injecting observations (${observationSystemMessage.length} chars)`);
      if (this.resourceScope) {
        console.info(`[OM processInputStep] Resource scope enabled`);
      }
      messageList.addSystem(observationSystemMessage, 'observational-memory');
    }

    // Safety net: also filter by observed IDs in case of edge cases
    // (e.g., messages created at exact same timestamp as lastObservedAt)
    // This runs every step to ensure new messages from tool calls are filtered
    const observedIds = [...record.observedMessageIds, ...record.bufferedMessageIds];
    if (observedIds.length > 0) {
      const beforeCount = messageList.get.all.db().length;
      messageList.removeByIds(observedIds);
      const afterCount = messageList.get.all.db().length;
      if (beforeCount !== afterCount) {
        console.info(`[OM processInputStep] Safety filter removed ${beforeCount - afterCount} messages by ID`);
      }
    }

    // Log what agent will actually see
    const finalMessages = messageList.get.all.db();
    console.info(`[OM processInputStep] Agent will see: observations + ${finalMessages.length} unobserved messages`);

    return messageList;
  }

  /**
   * Load messages from storage that haven't been observed yet.
   * Uses cursor-based query with lastObservedAt timestamp for efficiency.
   *
   * In resource scope mode, loads messages for the entire resource (all threads).
   * In thread scope mode, loads messages for just the current thread.
   */
  private async loadUnobservedMessages(
    threadId: string,
    resourceId: string | undefined,
    lastObservedAt?: Date,
  ): Promise<MastraDBMessage[]> {
    // Determine which thread IDs to query
    let threadIds: string[];

    if (this.resourceScope && resourceId) {
      // Resource scope: get all threads for this resource
      const threadsResult = await this.storage.listThreadsByResourceId({ resourceId });
      threadIds = threadsResult.threads.map(t => t.id);

      // If no threads found, fall back to current thread
      if (threadIds.length === 0) {
        threadIds = [threadId];
      }
    } else {
      // Thread scope: just the current thread
      threadIds = [threadId];
    }

    const result = await this.storage.listMessages({
      threadId: threadIds,
      perPage: false, // Get all messages (no pagination limit)
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: lastObservedAt
        ? {
            dateRange: {
              start: lastObservedAt,
            },
          }
        : undefined,
    });

    return result.messages;
  }

  /**
   * Group messages by threadId for resource-scoped processing.
   */
  private groupMessagesByThread(messages: MastraDBMessage[]): Map<string, MastraDBMessage[]> {
    const grouped = new Map<string, MastraDBMessage[]>();
    for (const msg of messages) {
      if (!msg.threadId) continue;
      const existing = grouped.get(msg.threadId) || [];
      existing.push(msg);
      grouped.set(msg.threadId, existing);
    }
    return grouped;
  }

  /**
   * Format unobserved messages from other threads as <unobserved-context> blocks.
   * These are injected into the Actor's context so it has awareness of activity
   * in other threads for the same resource.
   */
  private formatUnobservedContextBlocks(
    messagesByThread: Map<string, MastraDBMessage[]>,
    currentThreadId: string,
  ): string {
    const blocks: string[] = [];

    for (const [threadId, messages] of messagesByThread) {
      // Skip current thread - those go in normal message history
      if (threadId === currentThreadId) continue;

      // Skip if no messages
      if (messages.length === 0) continue;

      // Format messages with timestamps
      const formattedMessages = messages
        .filter(msg => msg.role !== 'system') // Exclude system messages
        .map(msg => {
          const timestamp = msg.createdAt ? new Date(msg.createdAt).toISOString() : 'unknown';
          const content =
            typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          return `[${timestamp}] ${msg.role}: ${content}`;
        })
        .join('\n');

      if (formattedMessages) {
        blocks.push(`<unobserved-context thread="${threadId}">
${formattedMessages}
</unobserved-context>`);
      }
    }

    return blocks.join('\n\n');
  }

  /**
   * Strip any thread tags that the Observer might have added.
   * Thread attribution is handled externally by the system, not by the Observer.
   * This is a defense-in-depth measure.
   */
  private stripThreadTags(observations: string): string {
    // Remove any <thread...> or </thread> tags the Observer might add
    return observations.replace(/<thread[^>]*>|<\/thread>/gi, '').trim();
  }

  /**
   * Wrap observations in a thread attribution tag.
   * Used in resource scope to track which thread observations came from.
   */
  private wrapWithThreadTag(threadId: string, observations: string): string {
    // First strip any thread tags the Observer might have added
    const cleanObservations = this.stripThreadTags(observations);
    return `<thread id="${threadId}">\n${cleanObservations}\n</thread>`;
  }

  /**
   * Replace or append a thread section in the observation pool.
   * If a section for this thread already exists, replace it.
   * Otherwise, append the new section.
   */
  private replaceOrAppendThreadSection(
    existingObservations: string,
    threadId: string,
    newThreadSection: string,
  ): string {
    // Pattern to match existing thread section for this threadId
    const threadPattern = new RegExp(
      `<thread id="${threadId}">\\s*[\\s\\S]*?\\s*</thread>`,
      'g',
    );

    if (threadPattern.test(existingObservations)) {
      // Replace existing section
      return existingObservations.replace(threadPattern, newThreadSection);
    } else {
      // Append new section
      return existingObservations
        ? `${existingObservations}\n\n${newThreadSection}`
        : newThreadSection;
    }
  }

  /**
   * Sort threads by their oldest unobserved message.
   * Returns thread IDs in order from oldest to most recent.
   * This ensures no thread's messages get "stuck" unobserved.
   */
  private sortThreadsByOldestMessage(
    messagesByThread: Map<string, MastraDBMessage[]>,
  ): string[] {
    const threadOrder = Array.from(messagesByThread.entries())
      .map(([threadId, messages]) => {
        // Find oldest message timestamp
        const oldestTimestamp = Math.min(
          ...messages.map(m => (m.createdAt ? new Date(m.createdAt).getTime() : Date.now())),
        );
        return { threadId, oldestTimestamp };
      })
      .sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);

    return threadOrder.map(t => t.threadId);
  }

  /**
   * Process output - track messages and trigger Observer/Reflector.
   * Supports async buffering when bufferEvery is configured.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList> {
    const { messageList, requestContext } = args;

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    // Re-fetch record to get latest state (buffering may have completed)
    let record = await this.getOrCreateRecord(threadId, resourceId);

    const allMessages = messageList.get.all.db();
    const unobservedMessages = this.getUnobservedMessages(allMessages, record);
    const currentSessionTokens = this.tokenCounter.countMessages(unobservedMessages);
    const currentObservationTokens = record.observationTokenCount ?? 0;
    // Include pending tokens from previous sessions for threshold check
    // Use type assertion since pendingMessageTokens was just added to ObservationalMemoryRecord
    const pendingTokens = record.pendingMessageTokens ?? 0;
    const totalPendingTokens = pendingTokens + currentSessionTokens;

    const threshold = this.calculateDynamicThreshold(
      this.observerConfig.observationThreshold,
      currentObservationTokens,
      this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
    );

    console.info(
      `[OM processOutputResult] Messages: ${allMessages.length}, Unobserved: ${unobservedMessages.length}, ` +
        `SessionTokens: ${currentSessionTokens}, PendingTokens: ${pendingTokens}, TotalPending: ${totalPendingTokens}, ` +
        `Threshold: ${threshold}`,
    );

    // ═══════════════════════════════════════════════════════════════════
    // SIMPLIFIED SYNC-ONLY FLOW (async buffering disabled)
    // ═══════════════════════════════════════════════════════════════════

    const shouldObserveNow = this.shouldObserve(totalPendingTokens, currentObservationTokens);
    console.info(
      `[OM] Observe check: totalPending=${totalPendingTokens} > threshold=${threshold} ? ${shouldObserveNow}`,
    );

    if (shouldObserveNow) {
      // ════════════════════════════════════════════════════════════
      // LOCKING: Check if observation is already in progress
      // This prevents race conditions when multiple threads are active
      // ════════════════════════════════════════════════════════════
      if (record.isObserving) {
        console.info(`[OM] Observation already in progress for ${record.id}, skipping`);
      } else {
        // ════════════════════════════════════════════════════════════
        // SYNC PATH: Do synchronous observation (blocking)
        // ════════════════════════════════════════════════════════════
        console.info(`[OM] Observation threshold exceeded (${totalPendingTokens} > ${threshold}), triggering Observer`);

        if (this.resourceScope && resourceId) {
          // Resource scope: observe ALL threads with unobserved messages
          await this.doResourceScopedObservation(record, threadId, resourceId);
        } else {
          // Thread scope: observe only current thread
          await this.doSynchronousObservation(record, threadId, unobservedMessages);
        }
      }
    } else if (currentSessionTokens > 0) {
      // ═══════════════════════════════════════════════════════════════════
      // Observation not triggered - accumulate pending tokens for next check
      // This allows observations to trigger after multiple small sessions
      // ═══════════════════════════════════════════════════════════════════
      console.info(`[OM] Accumulating ${currentSessionTokens} pending tokens (total will be ${totalPendingTokens})`);
      // Use type assertion since addPendingMessageTokens was just added to MemoryStorage
      await (this.storage as any).addPendingMessageTokens(record.id, currentSessionTokens);

      // Emit debug event for token accumulation
      this.emitDebugEvent({
        type: 'tokens_accumulated',
        timestamp: new Date(),
        threadId,
        resourceId: resourceId ?? '',
        pendingTokens,
        sessionTokens: currentSessionTokens,
        totalPendingTokens,
        threshold,
        messages: unobservedMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      });
    }

    // NOTE: Async reflection buffering disabled - reflection happens synchronously in maybeReflect()

    return messageList;
  }

  /**
   * Do synchronous observation (fallback when no buffering)
   */
  private async doSynchronousObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
  ): Promise<void> {
    const messageIdsToObserve = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

    // Emit debug event for observation triggered
    this.emitDebugEvent({
      type: 'observation_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      previousObservations: record.activeObservations,
      messages: unobservedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    });

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          console.info(`[OM] Another request already observed, skipping (lastObservedAt updated)`);
          return;
        }
      }

      const result = await this.callObserver(
        freshRecord?.activeObservations ?? record.activeObservations,
        unobservedMessages,
      );

      console.info(`[OM] Observer returned observations (${result.observations.length} chars)`);

      // Build new observations (use freshRecord if available)
      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
      let newObservations: string;
      if (this.resourceScope) {
        // In resource scope: wrap with thread tag and replace/append
        const threadSection = this.wrapWithThreadTag(threadId, result.observations);
        newObservations = this.replaceOrAppendThreadSection(
          existingObservations,
          threadId,
          threadSection,
        );
      } else {
        // In thread scope: simple append
        newObservations = existingObservations
          ? `${existingObservations}\n\n${result.observations}`
          : result.observations;
      }

      const totalTokenCount = this.tokenCounter.countObservations(newObservations);

      console.info(`[OM] Storing observations: ${totalTokenCount} tokens, ${messageIdsToObserve.length} message IDs`);

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        messageIds: messageIdsToObserve,
        tokenCount: totalTokenCount,
        lastObservedAt: new Date(),
      });

      // Save thread-specific metadata (currentTask, suggestedResponse)
      if (result.suggestedContinuation || result.currentTask) {
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            suggestedResponse: result.suggestedContinuation,
            currentTask: result.currentTask,
          });
          await this.storage.updateThread({
            id: threadId,
            title: thread.title ?? '',
            metadata: newMetadata,
          });
          console.info(`[OM] Updated thread metadata with suggestedResponse and currentTask`);
        }
      }

      console.info(`[OM] Observations stored successfully`);

      // Emit debug event for observation complete
      this.emitDebugEvent({
        type: 'observation_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        observations: newObservations,
        rawObserverOutput: result.observations,
        previousObservations: record.activeObservations,
        messages: unobservedMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      });

      // Check for reflection
      await this.maybeReflect({ ...record, activeObservations: newObservations }, totalTokenCount);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Resource-scoped observation: observe ALL threads with unobserved messages.
   * Threads are observed in oldest-first order to ensure no thread's messages
   * get "stuck" unobserved forever.
   *
   * Key differences from thread-scoped observation:
   * 1. Loads messages from ALL threads for the resource
   * 2. Observes threads one-by-one in oldest-first order
   * 3. Only updates lastObservedAt AFTER all threads are observed
   * 4. Only triggers reflection AFTER all threads are observed
   */
  private async doResourceScopedObservation(
    record: ObservationalMemoryRecord,
    currentThreadId: string,
    resourceId: string,
  ): Promise<void> {
    console.info(`[OM] Starting resource-scoped observation for resource ${resourceId}`);

    // Load ALL unobserved messages for the resource
    const allUnobservedMessages = await this.loadUnobservedMessages(
      currentThreadId,
      resourceId,
      record.lastObservedAt,
    );

    if (allUnobservedMessages.length === 0) {
      console.info(`[OM] No unobserved messages found for resource ${resourceId}`);
      return;
    }

    // Group by thread
    const messagesByThread = this.groupMessagesByThread(allUnobservedMessages);
    console.info(`[OM] Found ${messagesByThread.size} threads with unobserved messages`);

    // Sort threads by oldest message (oldest first)
    const threadOrder = this.sortThreadsByOldestMessage(messagesByThread);
    console.info(`[OM] Thread observation order: ${threadOrder.join(', ')}`);

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // Another request may have already observed while we were loading messages
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(null, resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          console.info(`[OM] Another request already observed, skipping (lastObservedAt updated)`);
          return;
        }
      }

      let currentObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
      let allMessageIds: string[] = [];

      // Observe each thread in order
      for (const threadId of threadOrder) {
        const threadMessages = messagesByThread.get(threadId) ?? [];
        if (threadMessages.length === 0) continue;

        const messageIds = threadMessages.map(m => m.id).filter((id): id is string => !!id);
        allMessageIds = [...allMessageIds, ...messageIds];

        console.info(`[OM] Observing thread ${threadId} with ${threadMessages.length} messages`);

        // Emit debug event for observation triggered
        this.emitDebugEvent({
          type: 'observation_triggered',
          timestamp: new Date(),
          threadId,
          resourceId,
          previousObservations: currentObservations,
          messages: threadMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
        });

        // Call observer for this thread's messages
        const result = await this.callObserver(currentObservations, threadMessages);
        console.info(`[OM] Observer returned observations for thread ${threadId} (${result.observations.length} chars)`);

        // Wrap with thread tag and replace/append
        const threadSection = this.wrapWithThreadTag(threadId, result.observations);
        currentObservations = this.replaceOrAppendThreadSection(
          currentObservations,
          threadId,
          threadSection,
        );

        // Update thread-specific metadata (currentTask, suggestedResponse)
        if (result.suggestedContinuation || result.currentTask) {
          const thread = await this.storage.getThreadById({ threadId });
          if (thread) {
            const newMetadata = setThreadOMMetadata(thread.metadata, {
              suggestedResponse: result.suggestedContinuation,
              currentTask: result.currentTask,
            });
            await this.storage.updateThread({
              id: threadId,
              title: thread.title ?? '',
              metadata: newMetadata,
            });
            console.info(`[OM] Updated thread ${threadId} metadata with suggestedResponse and currentTask`);
          }
        }

        // Emit debug event for observation complete
        this.emitDebugEvent({
          type: 'observation_complete',
          timestamp: new Date(),
          threadId,
          resourceId,
          observations: currentObservations,
          rawObserverOutput: result.observations,
          previousObservations: record.activeObservations,
          messages: threadMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
        });
      }

      // After ALL threads observed, update the record with final observations
      const totalTokenCount = this.tokenCounter.countObservations(currentObservations);
      const now = new Date();

      console.info(
        `[OM] All threads observed. Storing ${totalTokenCount} tokens, ${allMessageIds.length} message IDs`,
      );

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: currentObservations,
        messageIds: allMessageIds,
        tokenCount: totalTokenCount,
        lastObservedAt: now,
      });

      console.info(`[OM] Resource-scoped observation complete`);

      // Check for reflection AFTER all threads are observed
      await this.maybeReflect({ ...record, activeObservations: currentObservations }, totalTokenCount);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Check if reflection needed and trigger if so.
   * SIMPLIFIED: Always uses synchronous reflection (async buffering disabled).
   */
  private async maybeReflect(record: ObservationalMemoryRecord, observationTokens: number): Promise<void> {
    if (!this.shouldReflect(observationTokens)) {
      return;
    }

    // ════════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      console.info(`[OM] Reflection already in progress for ${record.id}, skipping`);
      return;
    }

    const reflectThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
    console.info(
      `[OM] Reflection threshold exceeded (${observationTokens} > ${reflectThreshold}), triggering Reflector`,
    );

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    await this.storage.setReflectingFlag(record.id, true);

    try {
      const reflectResult = await this.callReflector(record.activeObservations);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Note: Thread metadata updates for suggestedResponse happen in the calling context
      // (processOutputResult or reflect()) where threadId is available
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
  }

  /**
   * Manually trigger observation.
   */
  async observe(threadId: string, resourceId?: string, _prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);
    console.info(`[OM] Manual observation triggered for ${record.id}`);
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
      console.info(`[OM] No observations to reflect on for ${record.id}`);
      return;
    }

    console.info(`[OM] Manual reflection triggered for ${record.id}`);

    await this.storage.setReflectingFlag(record.id, true);

    try {
      const reflectResult = await this.callReflector(record.activeObservations, prompt);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Note: Thread metadata (currentTask, suggestedResponse) is preserved on each thread
      // and doesn't need to be updated during reflection - it was set during observation

      console.info(`[OM] Manual reflection complete, new generation created`);
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
