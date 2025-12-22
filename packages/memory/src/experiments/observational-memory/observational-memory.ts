import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { Processor, ProcessInputArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import { collapseObservations } from './collapser';
import type { CollapsedSection } from './collapser';
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
  CollapseConfig,
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
   * Configuration for memory collapsing (graceful decay).
   * When enabled, older observation sections are collapsed into summaries
   * while recent sections remain fully expanded.
   */
  collapse?: CollapseConfig;

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
  historyThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
  focus?: ObservationFocus;
}

interface ResolvedReflectorConfig {
  model: MastraModelConfig;
  observationThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
}

interface ResolvedCollapseConfig {
  enabled: boolean;
  minChildrenToCollapse: number;
  keepRecentSections: number;
  keepLastChildren: number;
  excludePatterns: RegExp[];
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

/**
 * Tracks in-progress async buffering operations
 */
interface BufferingOperation {
  /** Promise that resolves when buffering completes */
  promise: Promise<void>;
  /** Token count when buffering started */
  startedAtTokens: number;
  /** Timestamp when buffering started */
  startedAt: Date;
}

/** Timeout for waiting on in-progress buffering (ms) */
const BUFFERING_WAIT_TIMEOUT = 60_000; // 60 seconds

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
  private collapseConfig: ResolvedCollapseConfig;
  private onDebugEvent?: (event: ObservationDebugEvent) => void;

  /**
   * Store collapsed sections for retrieval.
   * Key is recordId, value is array of collapsed sections.
   */
  private collapsedSectionsCache: Map<string, CollapsedSection[]> = new Map();

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  /**
   * Track in-progress observation buffering per record.
   * Key is recordId, value is the buffering operation.
   */
  private observationBuffering: Map<string, BufferingOperation> = new Map();

  /**
   * Track in-progress reflection buffering per record.
   * Key is recordId, value is the buffering operation.
   */
  private reflectionBuffering: Map<string, BufferingOperation> = new Map();

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
      focus: config.observer?.focus,
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

    // Resolve collapse config with defaults
    this.collapseConfig = {
      enabled: config.collapse?.enabled ?? true,
      minChildrenToCollapse: config.collapse?.minChildrenToCollapse ?? 5,
      keepRecentSections: config.collapse?.keepRecentSections ?? 2,
      keepLastChildren: config.collapse?.keepLastChildren ?? 5,
      excludePatterns: config.collapse?.excludePatterns ?? [/Current Task/i],
    };

    this.tokenCounter = new TokenCounter();
    this.onDebugEvent = config.onDebugEvent;

    // Validate bufferEvery is less than threshold
    this.validateBufferConfig();
  }

  /**
   * Emit a debug event if the callback is configured
   */
  private emitDebugEvent(event: ObservationDebugEvent): void {
    if (this.onDebugEvent) {
      this.onDebugEvent(event);
    }
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
   * Check if we should start buffering observations.
   * Returns true if:
   * - bufferEvery is configured
   * - We've crossed the bufferEvery threshold
   * - We haven't crossed the main threshold yet
   * - No buffering is already in progress for this record
   */
  private shouldStartObservationBuffering(recordId: string, messageTokens: number, observationTokens: number): boolean {
    const bufferEvery = this.observerConfig.bufferEvery;
    if (!bufferEvery) return false;

    // Check if buffering is already in progress
    if (this.observationBuffering.has(recordId)) return false;

    // Check if there's already buffered content waiting
    // (This would be checked via record.bufferedObservations, but we keep it simple here)

    // Check if we've crossed bufferEvery but not the main threshold
    const mainThreshold = this.calculateDynamicThreshold(
      this.observerConfig.historyThreshold,
      observationTokens,
      this.getMaxThreshold(this.reflectorConfig.observationThreshold),
    );

    return messageTokens >= bufferEvery && messageTokens < mainThreshold;
  }

  /**
   * Check if we should start buffering reflections.
   */
  private shouldStartReflectionBuffering(recordId: string, observationTokens: number): boolean {
    const bufferEvery = this.reflectorConfig.bufferEvery;
    if (!bufferEvery) return false;

    // Check if buffering is already in progress
    if (this.reflectionBuffering.has(recordId)) return false;

    // Check if we've crossed bufferEvery but not the main threshold
    const mainThreshold = this.getMaxThreshold(this.reflectorConfig.observationThreshold);

    return observationTokens >= bufferEvery && observationTokens < mainThreshold;
  }

  /**
   * Start async observation buffering in the background.
   * Does NOT block - returns immediately and runs in background.
   */
  private startObservationBuffering(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    currentTokens: number,
  ): void {
    const messageIds = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

    console.log(`[OM Buffering] Starting async observation buffering for ${record.id} (${currentTokens} tokens)`);

    // Create the async operation
    const bufferingPromise = (async () => {
      try {
        // Mark messages as being buffered
        await this.storage.markMessagesAsBuffering(record.id, messageIds);

        // Call Observer agent
        const result = await this.callObserver(record.activeObservations, unobservedMessages);

        // In resource scope, add thread header
        let observationsWithHeader = result.observations;
        if (this.resourceScope) {
          observationsWithHeader = `**Thread: ${threadId}**\n\n${result.observations}`;
        }

        // Store as buffered (NOT active yet)
        await this.storage.updateBufferedObservations({
          id: record.id,
          observations: observationsWithHeader,
          messageIds,
          suggestedContinuation: result.suggestedContinuation,
        });

        console.log(`[OM Buffering] Observation buffering complete for ${record.id}`);
      } catch (error) {
        console.error(`[OM Buffering] Observation buffering failed for ${record.id}:`, error);
        // Clear buffering state on failure
        await this.storage.markMessagesAsBuffering(record.id, []);
        throw error;
      } finally {
        // Remove from tracking
        this.observationBuffering.delete(record.id);
      }
    })();

    // Track the operation
    this.observationBuffering.set(record.id, {
      promise: bufferingPromise,
      startedAtTokens: currentTokens,
      startedAt: new Date(),
    });
  }

  /**
   * Start async reflection buffering in the background.
   */
  private startReflectionBuffering(record: ObservationalMemoryRecord, observations: string): void {
    console.log(`[OM Buffering] Starting async reflection buffering for ${record.id}`);

    const bufferingPromise = (async () => {
      try {
        const result = await this.callReflector(observations);

        // Store as buffered reflection
        await this.storage.updateBufferedReflection(record.id, result.observations);

        console.log(`[OM Buffering] Reflection buffering complete for ${record.id}`);
      } catch (error) {
        console.error(`[OM Buffering] Reflection buffering failed for ${record.id}:`, error);
        throw error;
      } finally {
        this.reflectionBuffering.delete(record.id);
      }
    })();

    this.reflectionBuffering.set(record.id, {
      promise: bufferingPromise,
      startedAtTokens: record.observationTokenCount,
      startedAt: new Date(),
    });
  }

  /**
   * Wait for in-progress buffering with timeout.
   */
  private async waitForBuffering(operation: BufferingOperation, type: 'observation' | 'reflection'): Promise<void> {
    const elapsed = Date.now() - operation.startedAt.getTime();
    const remaining = BUFFERING_WAIT_TIMEOUT - elapsed;

    if (remaining <= 0) {
      throw new Error(`[OM] ${type} buffering timeout exceeded (started ${elapsed}ms ago)`);
    }

    console.log(`[OM] Waiting for in-progress ${type} buffering (max ${remaining}ms)...`);

    // Race between the operation and timeout
    await Promise.race([
      operation.promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[OM] ${type} buffering wait timeout`)), remaining),
      ),
    ]);
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
      providerOptions: this.observerConfig.providerOptions as any,
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
      providerOptions: this.reflectorConfig.providerOptions as any,
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
   * Applies collapsing and token optimization before presenting to the Actor.
   *
   * In resource scope mode, filters continuity messages to only show
   * the message for the current thread.
   */
  private formatObservationsForContext(
    observations: string,
    suggestedContinuation?: string,
    currentThreadId?: string,
    threadContinuityMessages?: Record<string, string>,
    recordId?: string,
  ): string {
    let processedObservations = observations;

    // Apply collapsing if enabled
    if (this.collapseConfig.enabled) {
      const collapseResult = collapseObservations(observations, {
        minChildrenToCollapse: this.collapseConfig.minChildrenToCollapse,
        keepRecentCount: this.collapseConfig.keepRecentSections,
        keepLastChildren: this.collapseConfig.keepLastChildren,
        excludePatterns: this.collapseConfig.excludePatterns,
      });

      processedObservations = collapseResult.text;

      // Cache collapsed sections for potential retrieval
      if (recordId && collapseResult.collapsedSections.length > 0) {
        this.collapsedSectionsCache.set(recordId, collapseResult.collapsedSections);
        console.info(
          `[OM] Collapsed ${collapseResult.collapsedSections.length} sections, saved ${collapseResult.tokensSaved} tokens`,
        );
      }
    }

    // Optimize observations to save tokens
    const optimized = optimizeObservationsForContext(processedObservations);

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
        record.id, // Record ID for caching collapsed sections
      );
      console.log(`[OM processInput] Injecting observations (${observationSystemMessage.length} chars)`);
      if (this.resourceScope) {
        console.log(
          `[OM processInput] Resource scope: observations from ${record.observedThreadIds?.length || 0} threads`,
        );
      }
      messageList.addSystem(observationSystemMessage, 'observational-memory');
    }

    // Load unobserved messages from storage using cursor-based query
    // This is more efficient than loading all messages and filtering by ID
    const lastObservedAt = record.metadata.lastObservedAt;
    const historicalMessages = await this.loadUnobservedMessages(threadId, lastObservedAt);

    if (historicalMessages.length > 0) {
      console.log(
        `[OM processInput] Loaded ${historicalMessages.length} messages since ${lastObservedAt?.toISOString() ?? 'beginning'}`,
      );

      // Add historical messages to messageList (excluding system messages)
      for (const msg of historicalMessages) {
        if (msg.role !== 'system') {
          messageList.add(msg, 'memory');
        }
      }
    }

    // Safety net: also filter by observed IDs in case of edge cases
    // (e.g., messages created at exact same timestamp as lastObservedAt)
    const observedIds = [...record.observedMessageIds, ...record.bufferedMessageIds];
    if (observedIds.length > 0) {
      const beforeCount = messageList.get.all.db().length;
      messageList.removeByIds(observedIds);
      const afterCount = messageList.get.all.db().length;
      if (beforeCount !== afterCount) {
        console.log(`[OM processInput] Safety filter removed ${beforeCount - afterCount} messages by ID`);
      }
    }

    // Log what agent will actually see
    const finalMessages = messageList.get.all.db();
    console.log(`[OM processInput] Agent will see: observations + ${finalMessages.length} unobserved messages`);

    return messageList;
  }

  /**
   * Load messages from storage that haven't been observed yet.
   * Uses cursor-based query with lastObservedAt timestamp for efficiency.
   */
  private async loadUnobservedMessages(threadId: string, lastObservedAt?: Date): Promise<MastraDBMessage[]> {
    const result = await this.storage.listMessages({
      threadId,
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

    console.log(
      `[OM processOutputResult] Messages: ${allMessages.length}, Unobserved: ${unobservedMessages.length}, ` +
        `SessionTokens: ${currentSessionTokens}, PendingTokens: ${pendingTokens}, TotalPending: ${totalPendingTokens}, ` +
        `Threshold: ${this.getMaxThreshold(this.observerConfig.historyThreshold)}`,
    );

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Check if we should START async buffering (proactive)
    // ═══════════════════════════════════════════════════════════════════
    const bufferEvery = this.observerConfig.bufferEvery;
    const shouldBuffer = this.shouldStartObservationBuffering(record.id, totalPendingTokens, currentObservationTokens);
    console.log(
      `[OM] Buffer check: totalPending=${totalPendingTokens}, bufferEvery=${bufferEvery}, shouldBuffer=${shouldBuffer}`,
    );

    if (shouldBuffer) {
      console.log(`[OM] Starting async observation buffering (${totalPendingTokens} >= ${bufferEvery})`);
      this.startObservationBuffering(record, threadId, unobservedMessages, totalPendingTokens);
      // Don't wait - continue with normal flow
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Check if we need to OBSERVE (threshold exceeded)
    // Use totalPendingTokens to trigger observation when accumulated across sessions
    // ═══════════════════════════════════════════════════════════════════
    const threshold = this.calculateDynamicThreshold(
      this.observerConfig.historyThreshold,
      currentObservationTokens,
      this.getMaxThreshold(this.reflectorConfig.observationThreshold),
    );
    const shouldObserveNow = this.shouldObserve(totalPendingTokens, currentObservationTokens);
    console.log(
      `[OM] Observe check: totalPending=${totalPendingTokens} > threshold=${threshold} ? ${shouldObserveNow}`,
    );

    if (shouldObserveNow) {
      const threshold = this.calculateDynamicThreshold(
        this.observerConfig.historyThreshold,
        currentObservationTokens,
        this.getMaxThreshold(this.reflectorConfig.observationThreshold),
      );

      console.log(`[OM] History threshold exceeded (${totalPendingTokens} > ${threshold})`);

      // Check if buffering is in progress
      const bufferingOp = this.observationBuffering.get(record.id);

      // Check if there's buffered content ready
      record = await this.getOrCreateRecord(threadId, resourceId);
      const hasBufferedContent = !!record.bufferedObservations;

      if (hasBufferedContent) {
        // ════════════════════════════════════════════════════════════
        // FAST PATH: Activate buffered content (non-blocking!)
        // ════════════════════════════════════════════════════════════
        console.log(`[OM] Activating buffered observations (fast path)`);

        await this.storage.swapBufferedToActive(record.id);

        // Re-fetch to get updated token counts
        record = await this.getOrCreateRecord(threadId, resourceId);
        const totalTokenCount = record.observationTokenCount;

        // Check if we need to reflect
        await this.maybeReflect(record, totalTokenCount);
      } else if (bufferingOp) {
        // ════════════════════════════════════════════════════════════
        // WAIT PATH: Buffering in progress, wait for it
        // ════════════════════════════════════════════════════════════
        console.log(`[OM] Waiting for in-progress buffering...`);

        await this.waitForBuffering(bufferingOp, 'observation');

        // Now activate the buffered content
        record = await this.getOrCreateRecord(threadId, resourceId);
        if (record.bufferedObservations) {
          await this.storage.swapBufferedToActive(record.id);
          record = await this.getOrCreateRecord(threadId, resourceId);
          await this.maybeReflect(record, record.observationTokenCount);
        }
      } else {
        // ════════════════════════════════════════════════════════════
        // SYNC PATH: No buffering, do synchronous observation
        // ════════════════════════════════════════════════════════════
        console.log(`[OM] No buffering available, doing synchronous observation`);

        await this.doSynchronousObservation(record, threadId, unobservedMessages);
      }
    } else if (currentSessionTokens > 0) {
      // ═══════════════════════════════════════════════════════════════════
      // Observation not triggered - accumulate pending tokens for next check
      // This allows observations to trigger after multiple small sessions
      // ═══════════════════════════════════════════════════════════════════
      console.log(`[OM] Accumulating ${currentSessionTokens} pending tokens (total will be ${totalPendingTokens})`);
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

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Check if we should START async reflection buffering
    // ═══════════════════════════════════════════════════════════════════
    record = await this.getOrCreateRecord(threadId, resourceId);
    if (this.shouldStartReflectionBuffering(record.id, record.observationTokenCount)) {
      console.log(
        `[OM] Starting async reflection buffering (${record.observationTokenCount} >= ${this.reflectorConfig.bufferEvery})`,
      );
      this.startReflectionBuffering(record, record.activeObservations);
    }

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

    await this.storage.setObservingFlag(record.id, true);

    try {
      const result = await this.callObserver(record.activeObservations, unobservedMessages);

      console.log(`[OM] Observer returned observations (${result.observations.length} chars)`);

      // In resource scope, add thread header
      let observationsWithHeader = result.observations;
      if (this.resourceScope) {
        observationsWithHeader = `**Thread: ${threadId}**\n\n${result.observations}`;
      }

      // Combine with existing
      const newObservations = record.activeObservations
        ? `${record.activeObservations}\n\n${observationsWithHeader}`
        : observationsWithHeader;

      const totalTokenCount = this.tokenCounter.countObservations(newObservations);

      console.log(`[OM] Storing observations: ${totalTokenCount} tokens, ${messageIdsToObserve.length} message IDs`);

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        messageIds: messageIdsToObserve,
        tokenCount: totalTokenCount,
        suggestedContinuation: result.suggestedContinuation,
        currentThreadId: this.resourceScope ? threadId : undefined,
        lastObservedAt: new Date(),
      });

      console.log(`[OM] Observations stored successfully`);

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
   * Check if reflection needed and trigger if so.
   * Handles both sync and async (buffered) reflection.
   */
  private async maybeReflect(record: ObservationalMemoryRecord, observationTokens: number): Promise<void> {
    if (!this.shouldReflect(observationTokens)) {
      return;
    }

    const reflectThreshold = this.getMaxThreshold(this.reflectorConfig.observationThreshold);
    console.log(`[OM] Observation threshold exceeded (${observationTokens} > ${reflectThreshold})`);

    // Check for buffered reflection
    const reflectionBufferingOp = this.reflectionBuffering.get(record.id);

    // Re-fetch record to check for buffered reflection
    const ids = this.getStorageIds(record.threadId ?? '', record.resourceId);
    const currentRecord = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);

    if (currentRecord?.bufferedReflection) {
      // ════════════════════════════════════════════════════════════
      // FAST PATH: Activate buffered reflection
      // ════════════════════════════════════════════════════════════
      console.log(`[OM] Activating buffered reflection (fast path)`);
      await this.storage.swapReflectionToActive(record.id);
    } else if (reflectionBufferingOp) {
      // ════════════════════════════════════════════════════════════
      // WAIT PATH: Reflection buffering in progress
      // ════════════════════════════════════════════════════════════
      console.log(`[OM] Waiting for in-progress reflection buffering...`);
      await this.waitForBuffering(reflectionBufferingOp, 'reflection');

      const updatedRecord = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
      if (updatedRecord?.bufferedReflection) {
        await this.storage.swapReflectionToActive(record.id);
      }
    } else {
      // ════════════════════════════════════════════════════════════
      // SYNC PATH: Do synchronous reflection
      // ════════════════════════════════════════════════════════════
      console.log(`[OM] Triggering synchronous Reflector`);

      await this.storage.setReflectingFlag(record.id, true);

      try {
        const reflectResult = await this.callReflector(record.activeObservations);
        const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

        await this.storage.createReflectionGeneration({
          currentRecord: record,
          reflection: reflectResult.observations,
          tokenCount: reflectionTokenCount,
          suggestedContinuation: reflectResult.suggestedContinuation,
        });
      } finally {
        await this.storage.setReflectingFlag(record.id, false);
      }
    }
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

  /**
   * Get current collapse configuration
   */
  getCollapseConfig(): ResolvedCollapseConfig {
    return this.collapseConfig;
  }

  /**
   * Get collapsed sections for a specific record.
   * Returns the cached collapsed sections that can be expanded if needed.
   */
  getCollapsedSections(recordId: string): CollapsedSection[] {
    return this.collapsedSectionsCache.get(recordId) ?? [];
  }

  /**
   * Expand a collapsed section by ID.
   * Returns the original full content of the collapsed section.
   *
   * @param recordId - The record ID
   * @param sectionId - The 4-character hex ID of the collapsed section
   * @returns The original content or null if not found
   */
  expandCollapsedSection(recordId: string, sectionId: string): string | null {
    const sections = this.collapsedSectionsCache.get(recordId);
    if (!sections) return null;

    const section = sections.find(s => s.id === sectionId);
    if (!section) return null;

    return section.originalContent;
  }
}
