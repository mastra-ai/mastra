import { Agent } from '@mastra/core/agent';
import type { AgentConfig, MastraDBMessage, MessageList } from '@mastra/core/agent';
import { coreFeatures } from '@mastra/core/features';
import type { MastraModelConfig } from '@mastra/core/llm';
import { resolveModelConfig } from '@mastra/core/llm';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ProcessInputStepArgs, ProcessorStreamWriter } from '@mastra/core/processors';
import { MessageHistory } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage, ObservationalMemoryRecord, BufferedObservationChunk } from '@mastra/core/storage';
import xxhash from 'xxhash-wasm';

import {
  OBSERVATIONAL_MEMORY_DEFAULTS,
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
} from './constants';
import { addRelativeTimeToObservations } from './date-utils';
import { omDebug, omError } from './debug';

import {
  createActivationMarker,
  createBufferingEndMarker,
  createBufferingFailedMarker,
  createBufferingStartMarker,
  createObservationEndMarker,
  createObservationFailedMarker,
  createObservationStartMarker,
} from './markers';
import {
  buildObserverSystemPrompt,
  buildObserverTaskPrompt,
  buildObserverHistoryMessage,
  buildMultiThreadObserverTaskPrompt,
  buildMultiThreadObserverHistoryMessage,
  parseObserverOutput,
  parseMultiThreadObserverOutput,
  optimizeObservationsForContext,
  formatMessagesForObserver,
} from './observer-agent';
import { registerOp, unregisterOp, isOpActiveInProcess } from './operation-registry';
import {
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
} from './reflector-agent';
import {
  calculateDynamicThreshold,
  calculateProjectedMessageRemoval,
  getMaxThreshold,
  resolveActivationRatio,
  resolveBlockAfter,
  resolveBufferTokens,
  resolveRetentionFloor,
} from './thresholds';
import { TokenCounter } from './token-counter';
import type { TokenCounterModelContext } from './token-counter';
import type {
  DataOmStatusPart,
  ObservationDebugEvent,
  ObservationalMemoryConfig,
  ObserveHooks,
  ResolvedObservationConfig,
  ResolvedReflectionConfig,
  ThresholdRange,
  ObservationMarkerConfig,
} from './types';

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
 * import { ObservationalMemory } from '@mastra/memory/processors';
 *
 * // Minimal configuration
 * const om = new ObservationalMemory({ storage });
 *
 * // Full configuration
 * const om = new ObservationalMemory({
 *   storage,
 *   model: 'google/gemini-2.5-flash', // shared model for both agents
 *   shareTokenBudget: true,
 *   observation: {
 *     messageTokens: 30_000,
 *     modelSettings: { temperature: 0.3 },
 *   },
 *   reflection: {
 *     observationTokens: 40_000,
 *   },
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [om],
 *   outputProcessors: [om],
 * });
 * ```
 */
export class ObservationalMemory {
  private storage: MemoryStorage;
  private tokenCounter: TokenCounter;
  readonly scope: 'resource' | 'thread';
  private observationConfig: ResolvedObservationConfig;
  private reflectionConfig: ResolvedReflectionConfig;
  private onDebugEvent?: (event: ObservationDebugEvent) => void;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  private shouldObscureThreadIds = false;
  private hasher = xxhash();
  private threadIdCache = new Map<string, string>();

  /**
   * Track message IDs observed during this instance's lifetime.
   * Prevents re-observing messages when per-thread lastObservedAt cursors
   * haven't fully advanced past messages observed in a prior cycle.
   */
  private observedMessageIds = new Set<string>();

  /** Internal MessageHistory for message persistence */
  private messageHistory: MessageHistory;

  /**
   * In-memory mutex for serializing observation/reflection cycles per resource/thread.
   * Prevents race conditions where two concurrent cycles could both read isObserving=false
   * before either sets it to true, leading to lost work.
   *
   * Key format: "resource:{resourceId}" or "thread:{threadId}"
   * Value: Promise that resolves when the lock is released
   *
   * NOTE: This mutex only works within a single Node.js process. For distributed
   * deployments, external locking (Redis, database locks) would be needed, or
   * accept eventual consistency (acceptable for v1).
   */
  private locks = new Map<string, Promise<void>>();

  /**
   * Track in-flight async buffering operations per resource/thread.
   * STATIC: Shared across all ObservationalMemory instances in this process.
   * This is critical because multiple OM instances are created per agent loop step,
   * and we need them to share knowledge of in-flight operations.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   * Value: Promise that resolves when buffering completes
   */
  static asyncBufferingOps = new Map<string, Promise<void>>();

  /**
   * Track the last token boundary at which we started buffering.
   * STATIC: Shared across all instances so boundary tracking persists across OM recreations.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   */
  static lastBufferedBoundary = new Map<string, number>();

  /**
   * Track the timestamp cursor for buffered messages.
   * STATIC: Shared across all instances so each buffer only observes messages
   * newer than the previous buffer's boundary.
   * Key format: "obs:{lockKey}"
   */
  static lastBufferedAtTime = new Map<string, Date>();

  /**
   * Tracks cycleId for in-flight buffered reflections.
   * STATIC: Shared across instances so we can match cycleId at activation time.
   * Key format: "refl:{lockKey}"
   */
  static reflectionBufferCycleIds = new Map<string, string>();

  /**
   * Track message IDs that have been sealed during async buffering.
   * STATIC: Shared across all instances so saveMessagesWithSealedIdTracking
   * generates new IDs when re-saving messages that were sealed in a previous step.
   * Key format: threadId
   * Value: Set of sealed message IDs
   */
  static sealedMessageIds = new Map<string, Set<string>>();

  /**
   * Check if async buffering is enabled for observations.
   */
  private isAsyncObservationEnabled(): boolean {
    const enabled = this.observationConfig.bufferTokens !== undefined && this.observationConfig.bufferTokens > 0;
    return enabled;
  }

  /**
   * Check if async buffering is enabled for reflections.
   * Reflection buffering is enabled when bufferActivation is set (triggers at threshold * bufferActivation).
   */
  private isAsyncReflectionEnabled(): boolean {
    return this.reflectionConfig.bufferActivation !== undefined && this.reflectionConfig.bufferActivation > 0;
  }

  /**
   * Get the buffer interval boundary key for observations.
   */
  private getObservationBufferKey(lockKey: string): string {
    return `obs:${lockKey}`;
  }

  /**
   * Get the buffer interval boundary key for reflections.
   */
  private getReflectionBufferKey(lockKey: string): string {
    return `refl:${lockKey}`;
  }

  /**
   * Clean up static maps for a thread/resource to prevent memory leaks.
   * Called after activation (to remove activated message IDs from sealedMessageIds)
   * and from clear() (to fully remove all static state for a thread).
   */
  private cleanupStaticMaps(threadId: string, resourceId?: string | null, activatedMessageIds?: string[]): void {
    const lockKey = this.getLockKey(threadId, resourceId);
    const obsBufKey = this.getObservationBufferKey(lockKey);
    const reflBufKey = this.getReflectionBufferKey(lockKey);

    if (activatedMessageIds) {
      // Partial cleanup: remove only activated IDs from sealedMessageIds
      const sealedSet = ObservationalMemory.sealedMessageIds.get(threadId);
      if (sealedSet) {
        for (const id of activatedMessageIds) {
          sealedSet.delete(id);
        }
        if (sealedSet.size === 0) {
          ObservationalMemory.sealedMessageIds.delete(threadId);
        }
      }
    } else {
      // Full cleanup: remove all static state for this thread
      ObservationalMemory.sealedMessageIds.delete(threadId);
      ObservationalMemory.lastBufferedAtTime.delete(obsBufKey);
      ObservationalMemory.lastBufferedBoundary.delete(obsBufKey);
      ObservationalMemory.lastBufferedBoundary.delete(reflBufKey);
      ObservationalMemory.asyncBufferingOps.delete(obsBufKey);
      ObservationalMemory.asyncBufferingOps.delete(reflBufKey);
      ObservationalMemory.reflectionBufferCycleIds.delete(reflBufKey);
    }
  }

  /**
   * Await any in-flight async buffering operations for a given thread/resource.
   * Returns once all buffering promises have settled (or after timeout).
   */
  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'thread' | 'resource',
    timeoutMs = 30000,
  ): Promise<void> {
    const lockKey = scope === 'resource' && resourceId ? `resource:${resourceId}` : `thread:${threadId ?? 'unknown'}`;
    const obsKey = `obs:${lockKey}`;
    const reflKey = `refl:${lockKey}`;

    const promises: Promise<void>[] = [];
    const obsOp = ObservationalMemory.asyncBufferingOps.get(obsKey);
    if (obsOp) promises.push(obsOp);
    const reflOp = ObservationalMemory.asyncBufferingOps.get(reflKey);
    if (reflOp) promises.push(reflOp);

    if (promises.length === 0) {
      return;
    }

    try {
      await Promise.race([
        Promise.all(promises),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
      ]);
    } catch {
      // Timeout or error - continue silently
    }
  }

  /**
   * Safely get bufferedObservationChunks as an array.
   * Handles cases where it might be a JSON string or undefined.
   */
  private getBufferedChunks(record: ObservationalMemoryRecord | null | undefined): BufferedObservationChunk[] {
    if (!record?.bufferedObservationChunks) return [];
    if (Array.isArray(record.bufferedObservationChunks)) return record.bufferedObservationChunks;
    if (typeof record.bufferedObservationChunks === 'string') {
      try {
        const parsed = JSON.parse(record.bufferedObservationChunks);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Refresh per-chunk messageTokens from the current in-memory message list.
   *
   * Buffered chunks store a messageTokens snapshot from when they were created,
   * but messages can be edited/sealed between buffering and activation, changing
   * their token weight. Using stale weights causes projected-removal math to
   * over- or under-estimate, leading to skipped activations or over-activation.
   *
   * Token recount only runs when the full chunk is present in the message list.
   * Partial recount is skipped because it would undercount and could cause
   * over-activation of buffered chunks.
   */
  private refreshBufferedChunkMessageTokens(
    chunks: BufferedObservationChunk[],
    messageList: MessageList,
  ): BufferedObservationChunk[] {
    const allMessages = messageList.get.all.db();
    const messageMap = new Map(allMessages.filter(m => m?.id).map(m => [m.id, m]));

    return chunks.map(chunk => {
      const chunkMessages = chunk.messageIds.map(id => messageMap.get(id)).filter((m): m is MastraDBMessage => !!m);

      // Only recount when ALL chunk messages are present — partial recount
      // would undercount and could over-activate buffered chunks.
      if (chunkMessages.length !== chunk.messageIds.length) {
        return chunk;
      }

      const refreshedTokens = this.tokenCounter.countMessages(chunkMessages);
      const refreshedMessageTokens = chunk.messageIds.reduce<Record<string, number>>((acc, id) => {
        const msg = messageMap.get(id);
        if (msg) {
          acc[id] = this.tokenCounter.countMessages([msg]);
        }
        return acc;
      }, {});

      return {
        ...chunk,
        messageTokens: refreshedTokens,
        messageTokenCounts: refreshedMessageTokens,
      };
    });
  }

  /**
   * Check if an async buffering operation is already in progress.
   */
  private isAsyncBufferingInProgress(bufferKey: string): boolean {
    return ObservationalMemory.asyncBufferingOps.has(bufferKey);
  }

  /**
   * Acquire a lock for the given key, execute the callback, then release.
   * If a lock is already held, waits for it to be released before acquiring.
   */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock to be released
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      // Release the lock
      releaseLock!();
      // Clean up if this is still our lock
      if (this.locks.get(key) === lockPromise) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Get the lock key for the current scope
   */
  private getLockKey(threadId: string | null | undefined, resourceId: string | null | undefined): string {
    if (this.scope === 'resource' && resourceId) {
      return `resource:${resourceId}`;
    }
    return `thread:${threadId ?? 'unknown'}`;
  }

  constructor(config: ObservationalMemoryConfig) {
    if (!coreFeatures.has('request-response-id-rotation')) {
      throw new Error(
        'Observational memory requires @mastra/core support for request-response-id-rotation. Please bump @mastra/core to a newer version.',
      );
    }

    // Validate that top-level model is not used together with sub-config models
    if (config.model && config.observation?.model) {
      throw new Error(
        'Cannot set both `model` and `observation.model`. Use `model` to set both agents, or set each individually.',
      );
    }
    if (config.model && config.reflection?.model) {
      throw new Error(
        'Cannot set both `model` and `reflection.model`. Use `model` to set both agents, or set each individually.',
      );
    }

    this.shouldObscureThreadIds = config.obscureThreadIds || false;
    this.storage = config.storage;
    this.scope = config.scope ?? 'thread';

    // Resolve "default" to the default model
    const resolveModel = (m: typeof config.model) =>
      m === 'default' ? OBSERVATIONAL_MEMORY_DEFAULTS.observation.model : m;

    // Require an explicit model — no silent default.
    // Resolution order: top-level model → sub-config model → the other sub-config model → error
    const observationModel =
      resolveModel(config.model) ?? resolveModel(config.observation?.model) ?? resolveModel(config.reflection?.model);
    const reflectionModel =
      resolveModel(config.model) ?? resolveModel(config.reflection?.model) ?? resolveModel(config.observation?.model);

    if (!observationModel || !reflectionModel) {
      throw new Error(
        `Observational Memory requires a model to be set. Use \`observationalMemory: true\` for the default (google/gemini-2.5-flash), or set a model explicitly:\n\n` +
          `  observationalMemory: {\n` +
          `    model: "$provider/$model",\n` +
          `  }\n\n` +
          `See https://mastra.ai/docs/memory/observational-memory#models for model recommendations and alternatives.`,
      );
    }

    // Get base thresholds first (needed for shared budget calculation)
    const messageTokens = config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens;
    const observationTokens =
      config.reflection?.observationTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.observationTokens;
    const isSharedBudget = config.shareTokenBudget ?? false;

    const isDefaultModelSelection = (model: AgentConfig['model'] | undefined) =>
      model === undefined || model === 'default';

    const observationSelectedModel = config.model ?? config.observation?.model ?? config.reflection?.model;
    const reflectionSelectedModel = config.model ?? config.reflection?.model ?? config.observation?.model;

    const observationDefaultMaxOutputTokens =
      config.observation?.modelSettings?.maxOutputTokens ??
      (isDefaultModelSelection(observationSelectedModel)
        ? OBSERVATIONAL_MEMORY_DEFAULTS.observation.modelSettings.maxOutputTokens
        : undefined);

    const reflectionDefaultMaxOutputTokens =
      config.reflection?.modelSettings?.maxOutputTokens ??
      (isDefaultModelSelection(reflectionSelectedModel)
        ? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.modelSettings.maxOutputTokens
        : undefined);

    // Total context budget when shared budget is enabled
    const totalBudget = messageTokens + observationTokens;

    // Async buffering is disabled when:
    // - bufferTokens: false is explicitly set
    // - scope is 'resource' and the user did NOT explicitly configure async buffering
    //   (if they did, validateBufferConfig will throw a helpful error)
    const userExplicitlyConfiguredAsync =
      config.observation?.bufferTokens !== undefined ||
      config.observation?.bufferActivation !== undefined ||
      config.reflection?.bufferActivation !== undefined;
    const asyncBufferingDisabled =
      config.observation?.bufferTokens === false || (config.scope === 'resource' && !userExplicitlyConfiguredAsync);

    // shareTokenBudget is not yet compatible with async buffering (temporary limitation).
    // To use shareTokenBudget, users must explicitly disable buffering.
    if (isSharedBudget && !asyncBufferingDisabled) {
      const common =
        `shareTokenBudget requires async buffering to be disabled (this is a temporary limitation). ` +
        `Add observation: { bufferTokens: false } to your config:\n\n` +
        `  observationalMemory: {\n` +
        `    shareTokenBudget: true,\n` +
        `    observation: { bufferTokens: false },\n` +
        `  }\n`;
      if (userExplicitlyConfiguredAsync) {
        throw new Error(
          common + `\nRemove any other async buffering settings (bufferTokens, bufferActivation, blockAfter).`,
        );
      } else {
        throw new Error(
          common + `\nAsync buffering is enabled by default — this opt-out is only needed when using shareTokenBudget.`,
        );
      }
    }

    // Resolve observation config with defaults
    this.observationConfig = {
      model: observationModel,
      // When shared budget, store as range: min = base threshold, max = total budget
      // This allows messages to expand into unused observation space
      messageTokens: isSharedBudget ? { min: messageTokens, max: totalBudget } : messageTokens,
      shareTokenBudget: isSharedBudget,
      modelSettings: {
        temperature:
          config.observation?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.observation.modelSettings.temperature,
        ...(observationDefaultMaxOutputTokens !== undefined
          ? { maxOutputTokens: observationDefaultMaxOutputTokens }
          : {}),
      },
      providerOptions: config.observation?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.providerOptions,
      maxTokensPerBatch:
        config.observation?.maxTokensPerBatch ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch,
      bufferTokens: asyncBufferingDisabled
        ? undefined
        : resolveBufferTokens(
            config.observation?.bufferTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferTokens,
            config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
          ),
      bufferActivation: asyncBufferingDisabled
        ? undefined
        : (config.observation?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferActivation),
      blockAfter: asyncBufferingDisabled
        ? undefined
        : resolveBlockAfter(
            config.observation?.blockAfter ??
              ((config.observation?.bufferTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferTokens)
                ? 1.2
                : undefined),
            config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
          ),
      instruction: config.observation?.instruction,
    };

    // Resolve reflection config with defaults
    this.reflectionConfig = {
      model: reflectionModel,
      observationTokens: observationTokens,
      shareTokenBudget: isSharedBudget,
      modelSettings: {
        temperature:
          config.reflection?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.reflection.modelSettings.temperature,
        ...(reflectionDefaultMaxOutputTokens !== undefined
          ? { maxOutputTokens: reflectionDefaultMaxOutputTokens }
          : {}),
      },
      providerOptions: config.reflection?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.providerOptions,
      bufferActivation: asyncBufferingDisabled
        ? undefined
        : (config?.reflection?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.bufferActivation),
      blockAfter: asyncBufferingDisabled
        ? undefined
        : resolveBlockAfter(
            config.reflection?.blockAfter ??
              ((config.reflection?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.bufferActivation)
                ? 1.2
                : undefined),
            config.reflection?.observationTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.observationTokens,
          ),
      instruction: config.reflection?.instruction,
    };

    this.tokenCounter = new TokenCounter(undefined, {
      model: typeof observationModel === 'string' ? observationModel : undefined,
    });
    this.onDebugEvent = config.onDebugEvent;

    // Create internal MessageHistory for message persistence
    // OM handles message saving itself (in processOutputStep) instead of relying on
    // the Memory class's MessageHistory processor
    this.messageHistory = new MessageHistory({ storage: this.storage });

    // Validate buffer configuration
    this.validateBufferConfig();

    omDebug(
      `[OM:init] new ObservationalMemory instance created — scope=${this.scope}, messageTokens=${JSON.stringify(this.observationConfig.messageTokens)}, obsAsyncEnabled=${this.isAsyncObservationEnabled()}, bufferTokens=${this.observationConfig.bufferTokens}, bufferActivation=${this.observationConfig.bufferActivation}, blockAfter=${this.observationConfig.blockAfter}, reflectionTokens=${this.reflectionConfig.observationTokens}, refAsyncEnabled=${this.isAsyncReflectionEnabled()}, refAsyncActivation=${this.reflectionConfig.bufferActivation}, refBlockAfter=${this.reflectionConfig.blockAfter}`,
    );
  }

  /**
   * Get the current configuration for this OM instance.
   * Used by the server to expose config to the UI when OM is added via processors.
   */
  get config(): {
    scope: 'resource' | 'thread';
    observation: {
      messageTokens: number | ThresholdRange;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
    };
  } {
    return {
      scope: this.scope,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
      },
      reflection: {
        observationTokens: this.reflectionConfig.observationTokens,
      },
    };
  }

  /**
   * Wait for any in-flight async buffering operations for the given thread/resource.
   * Used by server endpoints to block until buffering completes so the UI can get final state.
   */
  async waitForBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    timeoutMs = 30000,
  ): Promise<void> {
    return ObservationalMemory.awaitBuffering(threadId, resourceId, this.scope, timeoutMs);
  }

  private getModelToResolve(model: AgentConfig['model']): Parameters<typeof resolveModelConfig>[0] {
    if (Array.isArray(model)) {
      return (model[0]?.model ?? 'unknown') as Parameters<typeof resolveModelConfig>[0];
    }
    if (typeof model === 'function') {
      // Wrap to handle functions that may return ModelWithRetries[]
      return async ctx => {
        const result = await model(ctx);
        if (Array.isArray(result)) {
          return (result[0]?.model ?? 'unknown') as MastraModelConfig;
        }
        return result as MastraModelConfig;
      };
    }
    return model;
  }

  private formatModelName(model: TokenCounterModelContext) {
    if (!model.modelId) {
      return '(unknown)';
    }

    return model.provider ? `${model.provider}/${model.modelId}` : model.modelId;
  }

  private async resolveModelContext(
    modelConfig: AgentConfig['model'],
    requestContext?: RequestContext,
  ): Promise<TokenCounterModelContext | undefined> {
    const modelToResolve = this.getModelToResolve(modelConfig);
    if (!modelToResolve) {
      return undefined;
    }

    const resolved = await resolveModelConfig(modelToResolve, requestContext);
    return {
      provider: resolved.provider,
      modelId: resolved.modelId,
    };
  }

  getRuntimeModelContext(
    model: { provider: string; modelId: string } | undefined,
  ): TokenCounterModelContext | undefined {
    if (!model?.modelId) {
      return undefined;
    }

    return {
      provider: model.provider,
      modelId: model.modelId,
    };
  }

  runWithTokenCounterModelContext<T>(
    modelContext: TokenCounterModelContext | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.tokenCounter.runWithModelContext(modelContext, fn);
  }

  /**
   * Get the full config including resolved model names.
   * This is async because it needs to resolve the model configs.
   */
  async getResolvedConfig(requestContext?: RequestContext): Promise<{
    scope: 'resource' | 'thread';
    observation: {
      messageTokens: number | ThresholdRange;
      model: string;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
      model: string;
    };
  }> {
    const safeResolveModel = async (modelConfig: AgentConfig['model']): Promise<string> => {
      try {
        const resolved = await this.resolveModelContext(modelConfig, requestContext);
        return resolved?.modelId ? this.formatModelName(resolved) : '(unknown)';
      } catch (error) {
        omError('[OM] Failed to resolve model config', error);
        return '(unknown)';
      }
    };

    const [observationModelName, reflectionModelName] = await Promise.all([
      safeResolveModel(this.observationConfig.model),
      safeResolveModel(this.reflectionConfig.model),
    ]);

    return {
      scope: this.scope,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
        model: observationModelName,
      },
      reflection: {
        observationTokens: this.reflectionConfig.observationTokens,
        model: reflectionModelName,
      },
    };
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
   * Validate buffer configuration on first use.
   * Ensures bufferTokens is less than the threshold and bufferActivation is valid.
   */
  private validateBufferConfig(): void {
    // Async buffering is not yet supported with resource scope
    const hasAsyncBuffering =
      this.observationConfig.bufferTokens !== undefined ||
      this.observationConfig.bufferActivation !== undefined ||
      this.reflectionConfig.bufferActivation !== undefined;
    if (hasAsyncBuffering && this.scope === 'resource') {
      throw new Error(
        `Async buffering is not yet supported with scope: 'resource'. ` +
          `Use scope: 'thread', or set observation: { bufferTokens: false } to disable async buffering.`,
      );
    }

    // Validate observation bufferTokens
    const observationThreshold = getMaxThreshold(this.observationConfig.messageTokens);
    if (this.observationConfig.bufferTokens !== undefined) {
      if (this.observationConfig.bufferTokens <= 0) {
        throw new Error(`observation.bufferTokens must be > 0, got ${this.observationConfig.bufferTokens}`);
      }
      if (this.observationConfig.bufferTokens >= observationThreshold) {
        throw new Error(
          `observation.bufferTokens (${this.observationConfig.bufferTokens}) must be less than messageTokens (${observationThreshold})`,
        );
      }
    }

    // Validate observation bufferActivation: (0, 1] for ratio, or >= 1000 for absolute retention tokens
    if (this.observationConfig.bufferActivation !== undefined) {
      if (this.observationConfig.bufferActivation <= 0) {
        throw new Error(`observation.bufferActivation must be > 0, got ${this.observationConfig.bufferActivation}`);
      }
      if (this.observationConfig.bufferActivation > 1 && this.observationConfig.bufferActivation < 1000) {
        throw new Error(
          `observation.bufferActivation must be <= 1 (ratio) or >= 1000 (absolute token retention), got ${this.observationConfig.bufferActivation}`,
        );
      }
      if (
        this.observationConfig.bufferActivation >= 1000 &&
        this.observationConfig.bufferActivation >= observationThreshold
      ) {
        throw new Error(
          `observation.bufferActivation as absolute retention (${this.observationConfig.bufferActivation}) must be less than messageTokens (${observationThreshold})`,
        );
      }
    }

    // Validate observation blockAfter
    if (this.observationConfig.blockAfter !== undefined) {
      if (this.observationConfig.blockAfter < observationThreshold) {
        throw new Error(
          `observation.blockAfter (${this.observationConfig.blockAfter}) must be >= messageTokens (${observationThreshold})`,
        );
      }
      if (!this.observationConfig.bufferTokens) {
        throw new Error(
          `observation.blockAfter requires observation.bufferTokens to be set (blockAfter only applies when async buffering is enabled)`,
        );
      }
    }

    // Validate reflection bufferActivation (0-1 float range)
    if (this.reflectionConfig.bufferActivation !== undefined) {
      if (this.reflectionConfig.bufferActivation <= 0 || this.reflectionConfig.bufferActivation > 1) {
        throw new Error(
          `reflection.bufferActivation must be in range (0, 1], got ${this.reflectionConfig.bufferActivation}`,
        );
      }
    }

    // Validate reflection blockAfter
    if (this.reflectionConfig.blockAfter !== undefined) {
      const reflectionThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
      if (this.reflectionConfig.blockAfter < reflectionThreshold) {
        throw new Error(
          `reflection.blockAfter (${this.reflectionConfig.blockAfter}) must be >= reflection.observationTokens (${reflectionThreshold})`,
        );
      }
      if (!this.reflectionConfig.bufferActivation) {
        throw new Error(
          `reflection.blockAfter requires reflection.bufferActivation to be set (blockAfter only applies when async reflection is enabled)`,
        );
      }
    }
  }

  /**
   * Check whether the unobserved message tokens meet the observation threshold.
   */
  private meetsObservationThreshold(opts: {
    record: ObservationalMemoryRecord;
    unobservedTokens: number;
    extraTokens?: number;
  }): boolean {
    const { record, unobservedTokens, extraTokens = 0 } = opts;
    const pendingTokens = (record.pendingMessageTokens ?? 0) + unobservedTokens + extraTokens;
    const currentObservationTokens = record.observationTokenCount ?? 0;
    const threshold = calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);
    return pendingTokens >= threshold;
  }

  /**
   * Get or create the Observer agent
   */
  private getObserverAgent(): Agent {
    if (!this.observerAgent) {
      const systemPrompt = buildObserverSystemPrompt(false, this.observationConfig.instruction);

      this.observerAgent = new Agent({
        id: 'observational-memory-observer',
        name: 'Observer',
        instructions: systemPrompt,
        model: this.observationConfig.model,
      });
    }
    return this.observerAgent;
  }

  /**
   * Get or create the Reflector agent
   */
  private getReflectorAgent(): Agent {
    if (!this.reflectorAgent) {
      const systemPrompt = buildReflectorSystemPrompt(this.reflectionConfig.instruction);

      this.reflectorAgent = new Agent({
        id: 'observational-memory-reflector',
        name: 'Reflector',
        instructions: systemPrompt,
        model: this.reflectionConfig.model,
      });
    }
    return this.reflectorAgent;
  }

  /**
   * Get thread/resource IDs for storage lookup
   */
  private getStorageIds(threadId: string, resourceId?: string): { threadId: string | null; resourceId: string } {
    if (this.scope === 'resource') {
      return {
        threadId: null,
        resourceId: resourceId ?? threadId,
      };
    }
    if (!threadId) {
      throw new Error(
        `ObservationalMemory (scope: 'thread') requires a threadId, but received an empty value. ` +
          `This is a bug — getThreadContext should have caught this earlier.`,
      );
    }
    return {
      threadId,
      resourceId: resourceId ?? threadId,
    };
  }

  /**
   * Get or create the observational memory record.
   * Returns the existing record if one exists, otherwise initializes a new one.
   */
  async getOrCreateRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord> {
    const ids = this.getStorageIds(threadId, resourceId);
    let record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);

    if (!record) {
      // Capture the timezone used for Observer date formatting
      const observedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      record = await this.storage.initializeObservationalMemory({
        threadId: ids.threadId,
        resourceId: ids.resourceId,
        scope: this.scope,
        config: {
          observation: this.observationConfig,
          reflection: this.reflectionConfig,
          scope: this.scope,
        },
        observedTimezone,
      });
    }

    return record;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DATA-OM-OBSERVATION PART HELPERS (Start/End/Failed markers)
  // These helpers manage the observation boundary markers within messages.
  //
  // Flow:
  // 1. Before observation: [...messageParts]
  // 2. Insert start: [...messageParts, start] → stream to UI (loading state)
  // 3. After success: [...messageParts, start, end] → stream to UI (complete)
  // 4. After failure: [...messageParts, start, failed]
  //
  // For filtering, we look for the last completed observation (start + end pair).
  // A start without end means observation is in progress.
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get current config snapshot for observation markers.
   */
  private getObservationMarkerConfig(): ObservationMarkerConfig {
    return {
      messageTokens: getMaxThreshold(this.observationConfig.messageTokens),
      observationTokens: getMaxThreshold(this.reflectionConfig.observationTokens),
      scope: this.scope,
    };
  }

  /**
   * Persist a data-om-* marker part on the last assistant message in messageList
   * AND save the updated message to the DB so it survives page reload.
   * (data-* parts are filtered out before sending to the LLM, so they don't affect model calls.)
   */
  private async persistMarkerToMessage(
    marker: { type: string; data: unknown },
    messageList: MessageList | undefined,
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    if (!messageList) return;
    const allMsgs = messageList.get.all.db();
    // Find the last assistant message to attach the marker to
    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
        // Only push if the marker isn't already in the parts array.
        // writer.custom() adds the marker to the stream, and the AI SDK may have
        // already appended it to the message's parts before this runs.
        const markerData = marker.data as { cycleId?: string } | undefined;
        const alreadyPresent =
          markerData?.cycleId &&
          msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
        if (!alreadyPresent) {
          msg.content.parts.push(marker as any);
        }
        // Upsert the modified message to DB so the marker part is persisted.
        // Non-critical — if this fails, the marker is still in the stream,
        // it just won't survive page reload.
        try {
          await this.messageHistory.persistMessages({
            messages: [msg],
            threadId,
            resourceId,
          });
        } catch (e) {
          omDebug(`[OM:persistMarker] failed to save marker to DB: ${e}`);
        }
        return;
      }
    }
  }

  /**
   * Persist a marker to the last assistant message in storage.
   * Unlike persistMarkerToMessage, this fetches messages directly from the DB
   * so it works even when no MessageList is available (e.g. async buffering ops).
   */
  private async persistMarkerToStorage(
    marker: { type: string; data: unknown },
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    try {
      const result = await this.storage.listMessages({
        threadId,
        perPage: 20,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const messages = result?.messages ?? [];
      // Find the last assistant message
      for (const msg of messages) {
        if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
          // Only push if the marker isn't already in the parts array.
          const markerData = marker.data as { cycleId?: string } | undefined;
          const alreadyPresent =
            markerData?.cycleId &&
            msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
          if (!alreadyPresent) {
            msg.content.parts.push(marker as any);
          }
          await this.messageHistory.persistMessages({
            messages: [msg],
            threadId,
            resourceId,
          });
          return;
        }
      }
    } catch (e) {
      omDebug(`[OM:persistMarkerToStorage] failed to save marker to DB: ${e}`);
    }
  }

  /**
   * Find the last completed observation boundary in a message's parts.
   * A completed observation is a start marker followed by an end marker.
   *
   * Returns the index of the END marker (which is the observation boundary),
   * or -1 if no completed observation is found.
   */
  private findLastCompletedObservationBoundary(message: MastraDBMessage): number {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return -1;

    // Search from the end to find the most recent end marker
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i] as { type?: string };
      if (part?.type === 'data-om-observation-end') {
        // Found an end marker - this is the observation boundary
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if a message has an in-progress observation (start without end).
   */
  private hasInProgressObservation(message: MastraDBMessage): boolean {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return false;

    let lastStartIndex = -1;
    let lastEndOrFailedIndex = -1;

    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i] as { type?: string };
      if (part?.type === 'data-om-observation-start' && lastStartIndex === -1) {
        lastStartIndex = i;
      }
      if (
        (part?.type === 'data-om-observation-end' || part?.type === 'data-om-observation-failed') &&
        lastEndOrFailedIndex === -1
      ) {
        lastEndOrFailedIndex = i;
      }
    }

    // In progress if we have a start that comes after any end/failed
    return lastStartIndex !== -1 && lastStartIndex > lastEndOrFailedIndex;
  }

  /**
   * Seal messages to prevent new parts from being merged into them.
   * This is used when starting buffering to capture the current content state.
   *
   * Sealing works by:
   * 1. Setting `message.content.metadata.mastra.sealed = true` (message-level flag)
   * 2. Adding `metadata.mastra.sealedAt` to the last part (boundary marker)
   *
   * When MessageList.add() receives a message with the same ID as a sealed message,
   * it creates a new message with only the parts beyond the seal boundary.
   *
   * The messages are mutated in place - since they're references to the same objects
   * in the MessageList, the seal will be recognized immediately.
   *
   * @param messages - Messages to seal (mutated in place)
   */
  private sealMessagesForBuffering(messages: MastraDBMessage[]): void {
    const sealedAt = Date.now();

    for (const msg of messages) {
      if (!msg.content?.parts?.length) continue;

      // Set message-level sealed flag
      if (!msg.content.metadata) {
        msg.content.metadata = {};
      }
      const metadata = msg.content.metadata as { mastra?: { sealed?: boolean } };
      if (!metadata.mastra) {
        metadata.mastra = {};
      }
      metadata.mastra.sealed = true;

      // Add sealedAt to the last part
      const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
        metadata?: { mastra?: { sealedAt?: number } };
      };
      if (!lastPart.metadata) {
        lastPart.metadata = {};
      }
      if (!lastPart.metadata.mastra) {
        lastPart.metadata.mastra = {};
      }
      lastPart.metadata.mastra.sealedAt = sealedAt;
    }
  }

  /**
   * Insert an observation marker into a message.
   * The marker is appended directly to the message's parts array (mutating in place).
   * Also persists the change to storage so markers survive page refresh.
   *
   * For end/failed markers, the message is also "sealed" to prevent future content
   * from being merged into it. This ensures observation markers are preserved.
   */
  /**
   * Insert an observation marker into a message.
   * For start markers, this pushes the part directly.
   * For end/failed markers, this should be called AFTER writer.custom() has added the part,
   * so we just find the part and add sealing metadata.
   */

  /**
   * Get unobserved parts from a message.
   * If the message has a completed observation (start + end), only return parts after the end.
   * If observation is in progress (start without end), include parts before the start.
   * Otherwise, return all parts.
   */
  private getUnobservedParts(message: MastraDBMessage): MastraDBMessage['content']['parts'] {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return [];

    const endMarkerIndex = this.findLastCompletedObservationBoundary(message);
    if (endMarkerIndex === -1) {
      // No completed observation - all parts are unobserved
      // (This includes the case where observation is in progress)
      return parts.filter(p => {
        const part = p as { type?: string };
        // Exclude start markers that are in progress
        return part?.type !== 'data-om-observation-start';
      });
    }

    // Return only parts after the end marker (excluding start/end/failed markers)
    return parts.slice(endMarkerIndex + 1).filter(p => {
      const part = p as { type?: string };
      return !part?.type?.startsWith('data-om-observation-');
    });
  }

  /**
   * Check if a message has any unobserved parts.
   */
  private hasUnobservedParts(message: MastraDBMessage): boolean {
    return this.getUnobservedParts(message).length > 0;
  }

  /**
   * Create a virtual message containing only the unobserved parts.
   * This is used for token counting and observation.
   */
  private createUnobservedMessage(message: MastraDBMessage): MastraDBMessage | null {
    const unobservedParts = this.getUnobservedParts(message);
    if (unobservedParts.length === 0) return null;

    return {
      ...message,
      content: {
        ...message.content,
        parts: unobservedParts,
      },
    };
  }

  /**
   * Get unobserved messages with part-level filtering.
   *
   * This method uses data-om-observation-end markers to filter at the part level:
   * 1. For messages WITH a completed observation: only return parts AFTER the end marker
   * 2. For messages WITHOUT completed observation: check timestamp against lastObservedAt
   *
   * This handles the case where a single message accumulates many parts
   * (like tool calls) during an agentic loop - we only observe the new parts.
   */
  getUnobservedMessages(
    allMessages: MastraDBMessage[],
    record: ObservationalMemoryRecord,
    opts?: { excludeBuffered?: boolean },
  ): MastraDBMessage[] {
    const lastObservedAt = record.lastObservedAt;
    // Safeguard: track message IDs that were already observed to prevent re-observation
    // This handles edge cases like process restarts where lastObservedAt might not capture all messages
    const observedMessageIds = new Set<string>(
      Array.isArray(record.observedMessageIds) ? record.observedMessageIds : [],
    );

    // Only exclude buffered chunk message IDs when called from the buffering path.
    // The main agent context should still see buffered messages until activation.
    if (opts?.excludeBuffered) {
      const bufferedChunks = this.getBufferedChunks(record);
      for (const chunk of bufferedChunks) {
        if (Array.isArray(chunk.messageIds)) {
          for (const id of chunk.messageIds) {
            observedMessageIds.add(id);
          }
        }
      }
    }

    if (!lastObservedAt && observedMessageIds.size === 0) {
      // No observations yet - all messages are unobserved
      return allMessages;
    }

    const result: MastraDBMessage[] = [];

    for (const msg of allMessages) {
      // First check: skip if this message ID was already observed (safeguard against re-observation)
      if (observedMessageIds?.has(msg.id)) {
        continue;
      }

      // Check if this message has a completed observation
      const endMarkerIndex = this.findLastCompletedObservationBoundary(msg);
      const inProgress = this.hasInProgressObservation(msg);

      if (inProgress) {
        // Include the full message for in-progress observations
        // The Observer is currently working on this
        result.push(msg);
      } else if (endMarkerIndex !== -1) {
        // Message has a completed observation - only include parts after it
        const virtualMsg = this.createUnobservedMessage(msg);
        if (virtualMsg) {
          result.push(virtualMsg);
        } else {
        }
      } else {
        // No observation markers - fall back to timestamp-based filtering
        if (!msg.createdAt || !lastObservedAt) {
          // Messages without timestamps are always included
          // Also include messages when there's no lastObservedAt timestamp
          result.push(msg);
        } else {
          const msgDate = new Date(msg.createdAt);
          if (msgDate > lastObservedAt) {
            result.push(msg);
          } else {
          }
        }
      }
    }

    return result;
  }

  /**
   * Wrapper for observer/reflector agent.generate() calls that checks for abort.
   * agent.generate() returns an empty result on abort instead of throwing,
   * so we must check the signal before and after the call.
   * Retries are handled by Mastra's built-in p-retry at the model execution layer.
   */
  private async withAbortCheck<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }

    const result = await fn();

    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }

    return result;
  }

  /**
   * Call the Observer agent to extract observations.
   */
  private async callObserver(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: { skipContinuationHints?: boolean; requestContext?: RequestContext },
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getObserverAgent();

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildObserverTaskPrompt(existingObservations, options),
      },
      buildObserverHistoryMessage(messagesToObserve),
    ];

    const doGenerate = async () => {
      return this.withAbortCheck(async () => {
        const streamResult = await agent.stream(observerMessages, {
          modelSettings: {
            ...this.observationConfig.modelSettings,
          },
          providerOptions: this.observationConfig.providerOptions as any,
          ...(abortSignal ? { abortSignal } : {}),
          ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
        });

        return streamResult.getFullOutput();
      }, abortSignal);
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text);

    // Retry once if degenerate repetition was detected
    if (parsed.degenerate) {
      omDebug(`[OM:callObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callObserver] degenerate repetition on retry, failing`);
        throw new Error('Observer produced degenerate output after retry');
      }
    }

    // Extract usage from result (totalUsage or usage)
    const usage = result.totalUsage ?? result.usage;

    return {
      observations: parsed.observations,
      currentTask: parsed.currentTask,
      suggestedContinuation: parsed.suggestedContinuation,
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  }

  /**
   * Call the Observer agent for multiple threads in a single batched request.
   * This is more efficient than calling the Observer for each thread individually.
   * Returns per-thread results with observations, currentTask, and suggestedContinuation,
   * plus the total usage for the batch.
   */
  private async callMultiThreadObserver(
    existingObservations: string | undefined,
    messagesByThread: Map<string, MastraDBMessage[]>,
    threadOrder: string[],
    abortSignal?: AbortSignal,
    requestContext?: RequestContext,
  ): Promise<{
    results: Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
      }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    // Create a multi-thread observer agent with the special system prompt
    const agent = new Agent({
      id: 'multi-thread-observer',
      name: 'multi-thread-observer',
      model: this.observationConfig.model,
      instructions: buildObserverSystemPrompt(true, this.observationConfig.instruction),
    });

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildMultiThreadObserverTaskPrompt(existingObservations),
      },
      buildMultiThreadObserverHistoryMessage(messagesByThread, threadOrder),
    ];

    // Flatten all messages for context dump
    const allMessages: MastraDBMessage[] = [];
    for (const msgs of messagesByThread.values()) {
      allMessages.push(...msgs);
    }

    // Mark all messages as observed (skip any already-observed)
    for (const msg of allMessages) {
      this.observedMessageIds.add(msg.id);
    }

    const doGenerate = async () => {
      return this.withAbortCheck(async () => {
        const streamResult = await agent.stream(observerMessages, {
          modelSettings: {
            ...this.observationConfig.modelSettings,
          },
          providerOptions: this.observationConfig.providerOptions as any,
          ...(abortSignal ? { abortSignal } : {}),
          ...(requestContext ? { requestContext } : {}),
        });

        return streamResult.getFullOutput();
      }, abortSignal);
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text);

    // Retry once if degenerate repetition was detected
    if (parsed.degenerate) {
      omDebug(`[OM:callMultiThreadObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callMultiThreadObserver] degenerate repetition on retry, failing`);
        throw new Error('Multi-thread observer produced degenerate output after retry');
      }
    }

    // Convert to the expected return format
    const results = new Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
      }
    >();

    for (const [threadId, threadResult] of parsed.threads) {
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: threadResult.currentTask,
        suggestedContinuation: threadResult.suggestedContinuation,
      });
    }

    // If some threads didn't get results, log a warning
    for (const threadId of threadOrder) {
      if (!results.has(threadId)) {
        // Add empty result so we still update the cursor
        results.set(threadId, { observations: '' });
      }
    }

    // Extract usage from result
    const usage = result.totalUsage ?? result.usage;

    return {
      results,
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  }

  /**
   * Call the Reflector agent to condense observations.
   * Includes compression validation and retry logic.
   */
  private async callReflector(
    observations: string,
    manualPrompt?: string,
    streamContext?: {
      writer?: ProcessorStreamWriter;
      cycleId: string;
      startedAt: string;
      recordId: string;
      threadId: string;
    },
    observationTokensThreshold?: number,
    abortSignal?: AbortSignal,
    skipContinuationHints?: boolean,
    compressionStartLevel?: 0 | 1 | 2 | 3,
    requestContext?: RequestContext,
  ): Promise<{
    observations: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getReflectorAgent();

    const originalTokens = this.tokenCounter.countObservations(observations);

    // Get the target threshold - use provided value or fall back to config
    const targetThreshold = observationTokensThreshold ?? getMaxThreshold(this.reflectionConfig.observationTokens);

    // Track total usage across attempts
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // Attempt reflection with escalating compression levels.
    // Start at the provided level and retry up to level 3 if compression fails.
    let currentLevel: 0 | 1 | 2 | 3 = compressionStartLevel ?? 0;
    const maxLevel: 0 | 1 | 2 | 3 = 3;
    let parsed: ReturnType<typeof parseReflectorOutput> = { observations: '', suggestedContinuation: undefined };
    let reflectedTokens = 0;
    let attemptNumber = 0;

    while (currentLevel <= maxLevel) {
      attemptNumber++;
      const isRetry = attemptNumber > 1;

      const prompt = buildReflectorPrompt(observations, manualPrompt, currentLevel, skipContinuationHints);
      omDebug(
        `[OM:callReflector] ${isRetry ? `retry #${attemptNumber - 1}` : 'first attempt'}: level=${currentLevel}, originalTokens=${originalTokens}, targetThreshold=${targetThreshold}, promptLen=${prompt.length}, skipContinuationHints=${skipContinuationHints}`,
      );

      let chunkCount = 0;
      const result = await this.withAbortCheck(async () => {
        const streamResult = await agent.stream(prompt, {
          modelSettings: {
            ...this.reflectionConfig.modelSettings,
          },
          providerOptions: this.reflectionConfig.providerOptions as any,
          ...(abortSignal ? { abortSignal } : {}),
          ...(requestContext ? { requestContext } : {}),
          ...(attemptNumber === 1
            ? {
                onChunk(chunk: any) {
                  chunkCount++;
                  if (chunkCount === 1 || chunkCount % 50 === 0) {
                    const preview =
                      chunk.type === 'text-delta'
                        ? ` text="${chunk.textDelta?.slice(0, 80)}..."`
                        : chunk.type === 'tool-call'
                          ? ` tool=${chunk.toolName}`
                          : '';
                    omDebug(`[OM:callReflector] chunk#${chunkCount}: type=${chunk.type}${preview}`);
                  }
                },
                onFinish(event: any) {
                  omDebug(
                    `[OM:callReflector] onFinish: chunks=${chunkCount}, finishReason=${event.finishReason}, inputTokens=${event.usage?.inputTokens}, outputTokens=${event.usage?.outputTokens}, textLen=${event.text?.length}`,
                  );
                },
                onAbort(event: any) {
                  omDebug(`[OM:callReflector] onAbort: chunks=${chunkCount}, reason=${event?.reason ?? 'unknown'}`);
                },
                onError({ error }: { error: unknown }) {
                  omError(`[OM:callReflector] onError after ${chunkCount} chunks`, error);
                },
              }
            : {}),
        });

        return streamResult.getFullOutput();
      }, abortSignal);

      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} returned: textLen=${result.text?.length}, textPreview="${result.text?.slice(0, 120)}...", inputTokens=${result.usage?.inputTokens ?? result.totalUsage?.inputTokens}, outputTokens=${result.usage?.outputTokens ?? result.totalUsage?.outputTokens}`,
      );

      // Accumulate usage
      const usage = result.totalUsage ?? result.usage;
      if (usage) {
        totalUsage.inputTokens += usage.inputTokens ?? 0;
        totalUsage.outputTokens += usage.outputTokens ?? 0;
        totalUsage.totalTokens += usage.totalTokens ?? 0;
      }

      parsed = parseReflectorOutput(result.text);

      // If degenerate repetition detected, treat as compression failure
      if (parsed.degenerate) {
        omDebug(
          `[OM:callReflector] attempt #${attemptNumber}: degenerate repetition detected, treating as compression failure`,
        );
        reflectedTokens = originalTokens; // Force retry
      } else {
        reflectedTokens = this.tokenCounter.countObservations(parsed.observations);
      }
      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} parsed: reflectedTokens=${reflectedTokens}, targetThreshold=${targetThreshold}, compressionValid=${validateCompression(reflectedTokens, targetThreshold)}, parsedObsLen=${parsed.observations?.length}, degenerate=${parsed.degenerate ?? false}`,
      );

      // If compression succeeded or we've exhausted all levels, stop
      if (!parsed.degenerate && (validateCompression(reflectedTokens, targetThreshold) || currentLevel >= maxLevel)) {
        break;
      }

      // Guard against infinite loop: if degenerate persists at maxLevel, stop
      if (parsed.degenerate && currentLevel >= maxLevel) {
        omDebug(`[OM:callReflector] degenerate output persists at maxLevel=${maxLevel}, breaking`);
        break;
      }

      // Emit failed marker and start marker for next retry
      if (streamContext?.writer) {
        const failedMarker = createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: originalTokens,
          error: `Did not compress below threshold (${originalTokens} → ${reflectedTokens}, target: ${targetThreshold}), retrying at level ${currentLevel + 1}`,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
        });
        await streamContext.writer.custom(failedMarker).catch(() => {});

        const retryCycleId = crypto.randomUUID();
        streamContext.cycleId = retryCycleId;

        const startMarker = createObservationStartMarker({
          cycleId: retryCycleId,
          operationType: 'reflection',
          tokensToObserve: originalTokens,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
          threadIds: [streamContext.threadId],
          config: this.getObservationMarkerConfig(),
        });
        streamContext.startedAt = startMarker.data.startedAt;
        await streamContext.writer.custom(startMarker).catch(() => {});
      }

      // Escalate to next compression level
      currentLevel = Math.min(currentLevel + 1, maxLevel) as 0 | 1 | 2 | 3;
    }

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
      usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
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
    currentTask?: string,
    suggestedResponse?: string,
    unobservedContextBlocks?: string,
    currentDate?: Date,
  ): string {
    // Optimize observations to save tokens
    let optimized = optimizeObservationsForContext(observations);

    // Add relative time annotations to date headers if currentDate is provided
    if (currentDate) {
      optimized = addRelativeTimeToObservations(optimized, currentDate);
    }

    let content = `
${OBSERVATION_CONTEXT_PROMPT}

<observations>
${optimized}
</observations>

${OBSERVATION_CONTEXT_INSTRUCTIONS}`;

    // Add unobserved context from other threads (resource scope only)
    if (unobservedContextBlocks) {
      content += `\n\nThe following content is from OTHER conversations different from the current conversation, they're here for reference,  but they're not necessarily your focus:\nSTART_OTHER_CONVERSATIONS_BLOCK\n${unobservedContextBlocks}\nEND_OTHER_CONVERSATIONS_BLOCK`;
    }

    // Dynamically inject current-task from thread metadata (not stored in observations)
    if (currentTask) {
      content += `

<current-task>
${currentTask}
</current-task>`;
    }

    if (suggestedResponse) {
      content += `

<suggested-response>
${suggestedResponse}
</suggested-response>
`;
    }

    return content;
  }

  /**
   * Get threadId and resourceId from either RequestContext or MessageList
   */
  getThreadContext(
    requestContext: RequestContext | undefined,
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

    // In thread scope, threadId is required — without it OM would silently
    // fall back to a resource-keyed record which causes deadlocks when
    // multiple threads share the same resourceId.
    if (this.scope === 'thread') {
      throw new Error(
        `ObservationalMemory (scope: 'thread') requires a threadId, but none was found in RequestContext or MessageList. ` +
          `Ensure the agent is configured with Memory and a valid threadId is provided.`,
      );
    }

    return null;
  }

  /**
   * Save messages to storage while preventing duplicate inserts for sealed messages.
   *
   * Sealed messages that do not yet contain a completed observation boundary are
   * skipped because async buffering already persisted them.
   */
  private async saveMessagesWithSealedIdTracking(
    messagesToSave: MastraDBMessage[],
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
  ): Promise<void> {
    // Handle sealed messages:
    // - Messages with observation markers: keep the same ID so storage upserts instead of inserting duplicates
    // - Messages without observation markers (e.g., sealed for async buffering): skip entirely,
    //   they were already persisted by runAsyncBufferedObservation (fixes #13089)
    const filteredMessages: MastraDBMessage[] = [];
    for (const msg of messagesToSave) {
      if (sealedIds.has(msg.id)) {
        if (this.findLastCompletedObservationBoundary(msg) !== -1) {
          filteredMessages.push(msg);
        }
        // else: sealed for buffering only, already persisted — skip to avoid duplication
      } else {
        filteredMessages.push(msg);
      }
    }

    if (filteredMessages.length > 0) {
      await this.messageHistory.persistMessages({
        messages: filteredMessages,
        threadId,
        resourceId,
      });
    }

    // After successful save, track IDs of messages that now have observation markers (sealed)
    // These IDs cannot be reused in future cycles
    for (const msg of filteredMessages) {
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        sealedIds.add(msg.id);
      }
    }
    state.sealedIds = sealedIds;
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
    // Add 1ms to lastObservedAt to make the filter exclusive (since dateRange.start is inclusive)
    // This prevents re-loading the same messages that were already observed
    const startDate = lastObservedAt ? new Date(lastObservedAt.getTime() + 1) : undefined;

    let result: { messages: MastraDBMessage[] };

    if (this.scope === 'resource' && resourceId) {
      // Resource scope: use the new listMessagesByResourceId method
      result = await this.storage.listMessagesByResourceId({
        resourceId,
        perPage: false, // Get all messages (no pagination limit)
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate
          ? {
              dateRange: {
                start: startDate,
              },
            }
          : undefined,
      });
    } else {
      // Thread scope: use listMessages with threadId
      result = await this.storage.listMessages({
        threadId,
        perPage: false, // Get all messages (no pagination limit)
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate
          ? {
              dateRange: {
                start: startDate,
              },
            }
          : undefined,
      });
    }

    return result.messages;
  }

  /**
   * Format unobserved messages from other threads as <unobserved-context> blocks.
   * These are injected into the Actor's context so it has awareness of activity
   * in other threads for the same resource.
   */
  private async formatUnobservedContextBlocks(
    messagesByThread: Map<string, MastraDBMessage[]>,
    currentThreadId: string,
  ): Promise<string> {
    const blocks: string[] = [];

    for (const [threadId, messages] of messagesByThread) {
      // Skip current thread - those go in normal message history
      if (threadId === currentThreadId) continue;

      // Skip if no messages
      if (messages.length === 0) continue;

      // Format messages with timestamps, truncating large parts (e.g. tool results)
      // since this is injected as context for the actor, not sent to the observer
      const formattedMessages = formatMessagesForObserver(messages, { maxPartLength: 500 });

      if (formattedMessages) {
        const obscuredId = await this.representThreadIDInContext(threadId);
        blocks.push(`<other-conversation id="${obscuredId}">
${formattedMessages}
</other-conversation>`);
      }
    }

    return blocks.join('\n\n');
  }

  private async representThreadIDInContext(threadId: string): Promise<string> {
    if (this.shouldObscureThreadIds) {
      // Check cache first
      const cached = this.threadIdCache.get(threadId);
      if (cached) return cached;

      // Use xxhash (32-bit) to create short, opaque, non-reversible identifiers
      // This prevents LLMs from recognizing patterns like "answer_" in base64
      const hasher = await this.hasher;
      const hashed = hasher.h32ToString(threadId);
      this.threadIdCache.set(threadId, hashed);
      return hashed;
    }
    return threadId;
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
   * Get the maximum createdAt timestamp from a list of messages.
   * Used to set lastObservedAt to the most recent message timestamp instead of current time.
   * This ensures historical data (like LongMemEval fixtures) works correctly.
   */
  private getMaxMessageTimestamp(messages: MastraDBMessage[]): Date {
    let maxTime = 0;
    for (const msg of messages) {
      if (msg.createdAt) {
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime > maxTime) {
          maxTime = msgTime;
        }
      }
    }
    // If no valid timestamps found, fall back to current time
    return maxTime > 0 ? new Date(maxTime) : new Date();
  }

  /**
   * Compute a cursor pointing at the latest message by createdAt.
   * Used to derive a stable observation boundary for replay pruning.
   */
  private getLastObservedMessageCursor(messages: MastraDBMessage[]): { createdAt: string; id: string } | undefined {
    let latest: MastraDBMessage | undefined;
    for (const msg of messages) {
      if (!msg?.id || !msg.createdAt) continue;
      if (!latest || new Date(msg.createdAt).getTime() > new Date(latest.createdAt!).getTime()) {
        latest = msg;
      }
    }
    return latest ? { createdAt: new Date(latest.createdAt!).toISOString(), id: latest.id } : undefined;
  }

  /**
   * Check if a message is at or before a cursor (by createdAt then id).
   */
  private isMessageAtOrBeforeCursor(msg: MastraDBMessage, cursor: { createdAt: string; id: string }): boolean {
    if (!msg.createdAt) return false;
    const msgIso = new Date(msg.createdAt).toISOString();
    if (msgIso < cursor.createdAt) return true;
    if (msgIso === cursor.createdAt && msg.id === cursor.id) return true;
    return false;
  }

  /**
   * Wrap observations in a thread attribution tag.
   * Used in resource scope to track which thread observations came from.
   */
  private async wrapWithThreadTag(threadId: string, observations: string): Promise<string> {
    // First strip any thread tags the Observer might have added
    const cleanObservations = this.stripThreadTags(observations);
    const obscuredId = await this.representThreadIDInContext(threadId);
    return `<thread id="${obscuredId}">\n${cleanObservations}\n</thread>`;
  }

  /**
   * Append or merge new thread sections.
   * If the new section has the same thread ID and date as an existing section,
   * merge the observations into that section to reduce token usage.
   * Otherwise, append as a new section.
   */
  private replaceOrAppendThreadSection(
    existingObservations: string,
    _threadId: string,
    newThreadSection: string,
  ): string {
    if (!existingObservations) {
      return newThreadSection;
    }

    // Extract thread ID and date from new section
    const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
    const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

    if (!threadIdMatch || !dateMatch) {
      // Can't parse, just append
      return `${existingObservations}\n\n${newThreadSection}`;
    }

    const newThreadId = threadIdMatch[1]!;
    const newDate = dateMatch[1]!;

    // Look for existing section with same thread ID and date.
    // Use string search instead of regex to avoid polynomial backtracking (CodeQL).
    const threadOpen = `<thread id="${newThreadId}">`;
    const threadClose = '</thread>';
    const startIdx = existingObservations.indexOf(threadOpen);
    let existingSection: string | null = null;
    let existingSectionStart = -1;
    let existingSectionEnd = -1;

    if (startIdx !== -1) {
      const closeIdx = existingObservations.indexOf(threadClose, startIdx);
      if (closeIdx !== -1) {
        existingSectionEnd = closeIdx + threadClose.length;
        existingSectionStart = startIdx;
        const section = existingObservations.slice(startIdx, existingSectionEnd);
        // Verify this section contains the matching date
        if (section.includes(`Date: ${newDate}`) || section.includes(`Date:${newDate}`)) {
          existingSection = section;
        }
      }
    }

    if (existingSection) {
      // Found existing section with same thread ID and date - merge observations
      // Extract observations from new section: everything after the Date: line, before </thread>
      const dateLineEnd = newThreadSection.indexOf('\n', newThreadSection.indexOf('Date:'));
      const newCloseIdx = newThreadSection.lastIndexOf(threadClose);
      if (dateLineEnd !== -1 && newCloseIdx !== -1) {
        const newObsContent = newThreadSection.slice(dateLineEnd + 1, newCloseIdx).trim();
        if (newObsContent) {
          // Insert new observations at the end of the existing section (before </thread>)
          const withoutClose = existingSection.slice(0, existingSection.length - threadClose.length).trimEnd();
          const merged = `${withoutClose}\n${newObsContent}\n${threadClose}`;
          return (
            existingObservations.slice(0, existingSectionStart) +
            merged +
            existingObservations.slice(existingSectionEnd)
          );
        }
      }
    }

    // No existing section with same thread ID and date - append
    return `${existingObservations}\n\n${newThreadSection}`;
  }

  /**
   * Sort threads by their oldest unobserved message.
   * Returns thread IDs in order from oldest to most recent.
   * This ensures no thread's messages get "stuck" unobserved.
   */
  private sortThreadsByOldestMessage(messagesByThread: Map<string, MastraDBMessage[]>): string[] {
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
   * Do synchronous observation (fallback when no buffering)
   */
  private async doSynchronousObservation(opts: {
    record: ObservationalMemoryRecord;
    threadId: string;
    unobservedMessages: MastraDBMessage[];
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { record, threadId, unobservedMessages, writer, abortSignal, reflectionHooks, requestContext } = opts;
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
    registerOp(record.id, 'observing');

    // Generate unique cycle ID for this observation cycle
    // This ties together the start/end/failed markers
    const cycleId = crypto.randomUUID();

    // Insert START marker before observation (uses total unobserved as estimate;
    // actual observed count may be smaller with ratio-aware observation)
    const tokensToObserve = await this.tokenCounter.countMessagesAsync(unobservedMessages);
    const lastMessage = unobservedMessages[unobservedMessages.length - 1];
    const startedAt = new Date().toISOString();

    if (lastMessage?.id) {
      const startMarker = createObservationStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToObserve,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
        config: this.getObservationMarkerConfig(),
      });
      // Stream the start marker to the UI first - this adds the part via stream handler
      if (writer) {
        await writer.custom(startMarker).catch(() => {
          // Ignore errors from streaming - observation should continue
        });
      }

      // Then add to message (skipPush since writer.custom already added the part)
    }

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          return;
        }
      }

      // ════════════════════════════════════════════════════════════
      // RATIO-AWARE MESSAGE SEALING
      // When bufferActivation is set and sync observation fires, seal the
      // most recent message so any future parts added by the LLM go into
      // a new message. This keeps the observation scope bounded — the sealed
      // content gets observed now, and new content accumulates separately
      // for the next observation cycle.
      // ════════════════════════════════════════════════════════════
      let messagesToObserve = unobservedMessages;
      const bufferActivation = this.observationConfig.bufferActivation;
      if (bufferActivation && bufferActivation < 1 && unobservedMessages.length >= 1) {
        const newestMsg = unobservedMessages[unobservedMessages.length - 1];
        if (newestMsg?.content?.parts?.length) {
          this.sealMessagesForBuffering([newestMsg]);
          omDebug(
            `[OM:sync-obs] sealed newest message (${newestMsg.role}, ${newestMsg.content.parts.length} parts) for ratio-aware observation`,
          );
        }
      }

      const result = await this.callObserver(
        freshRecord?.activeObservations ?? record.activeObservations,
        messagesToObserve,
        abortSignal,
        { requestContext },
      );

      // Build new observations (use freshRecord if available)
      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
      let newObservations: string;
      if (this.scope === 'resource') {
        // In resource scope: wrap with thread tag and replace/append
        const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
        newObservations = this.replaceOrAppendThreadSection(existingObservations, threadId, threadSection);
      } else {
        // In thread scope: simple append
        newObservations = existingObservations
          ? `${existingObservations}\n\n${result.observations}`
          : result.observations;
      }

      let totalTokenCount = this.tokenCounter.countObservations(newObservations);

      // Calculate tokens generated in THIS cycle only (for UI marker)
      const cycleObservationTokens = this.tokenCounter.countObservations(result.observations);

      // Use the max message timestamp as cursor — only for the messages we actually observed
      const lastObservedAt = this.getMaxMessageTimestamp(messagesToObserve);

      // Collect message IDs being observed for the safeguard
      // Only mark the messages we actually observed, not the ones we kept
      const newMessageIds = messagesToObserve.map(m => m.id);
      const existingIds = freshRecord?.observedMessageIds ?? record.observedMessageIds ?? [];
      const allObservedIds = [...new Set([...(Array.isArray(existingIds) ? existingIds : []), ...newMessageIds])];

      // Save thread-specific metadata BEFORE updating the OM record.
      // This ensures a consistent lock ordering (mastra_threads → mastra_observational_memory)
      // that matches the order used by saveMessages, preventing PostgreSQL deadlocks
      // when concurrent agents share a resourceId.
      const thread = await this.storage.getThreadById({ threadId });
      if (thread) {
        const newMetadata = setThreadOMMetadata(thread.metadata, {
          suggestedResponse: result.suggestedContinuation,
          currentTask: result.currentTask,
          lastObservedMessageCursor: this.getLastObservedMessageCursor(messagesToObserve),
        });
        await this.storage.updateThread({
          id: threadId,
          title: thread.title ?? '',
          metadata: newMetadata,
        });
      }

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        observedMessageIds: allObservedIds,
      });

      // ════════════════════════════════════════════════════════════════════════
      // INSERT END MARKER after successful observation
      // This marks the boundary between observed and unobserved parts
      // ════════════════════════════════════════════════════════════════════════
      const actualTokensObserved = await this.tokenCounter.countMessagesAsync(messagesToObserve);
      if (lastMessage?.id) {
        const endMarker = createObservationEndMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensObserved: actualTokensObserved,
          observationTokens: cycleObservationTokens,
          observations: result.observations,
          currentTask: result.currentTask,
          suggestedResponse: result.suggestedContinuation,
          recordId: record.id,
          threadId,
        });

        // Stream the end marker to the UI first - this adds the part via stream handler
        if (writer) {
          await writer.custom(endMarker).catch(() => {
            // Ignore errors from streaming - observation should continue
          });
        }

        // Then seal the message (skipPush since writer.custom already added the part)
      }

      // Emit debug event for observation complete
      this.emitDebugEvent({
        type: 'observation_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        observations: newObservations,
        rawObserverOutput: result.observations,
        previousObservations: record.activeObservations,
        messages: messagesToObserve.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        usage: result.usage,
      });

      // Check for reflection
      await this.maybeReflect({
        record: { ...record, activeObservations: newObservations },
        observationTokens: totalTokenCount,
        threadId,
        writer,
        abortSignal,
        reflectionHooks,
        requestContext,
      });
    } catch (error) {
      // Insert FAILED marker on error
      if (lastMessage?.id) {
        const failedMarker = createObservationFailedMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensAttempted: tokensToObserve,
          error: error instanceof Error ? error.message : String(error),
          recordId: record.id,
          threadId,
        });

        // Stream the failed marker to the UI first - this adds the part via stream handler
        if (writer) {
          await writer.custom(failedMarker).catch(() => {
            // Ignore errors from streaming - observation should continue
          });
        }

        // Then seal the message (skipPush since writer.custom already added the part)
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - observation failure should not crash the agent
      omError('[OM] Observation failed', error);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
      unregisterOp(record.id, 'observing');
    }
  }

  /**
   * Start an async background observation that stores results to bufferedObservations.
   * This is a fire-and-forget operation that runs in the background.
   * The results will be swapped to active when the main threshold is reached.
   *
   * If another buffering operation is already in progress for this scope, this will
   * wait for it to complete before starting a new one (mutex behavior).
   *
   * @param record - Current OM record
   * @param threadId - Thread ID
   * @param unobservedMessages - All unobserved messages (will be filtered for already-buffered)
   * @param lockKey - Lock key for this scope
   * @param writer - Optional stream writer for emitting buffering markers
   */
  private async startAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    lockKey: string,
    writer?: ProcessorStreamWriter,
    contextWindowTokens?: number,
    requestContext?: RequestContext,
  ): Promise<void> {
    const bufferKey = this.getObservationBufferKey(lockKey);

    // Update the last buffered boundary (in-memory for current instance).
    // Use contextWindowTokens (all messages in context) to match the scale of
    // totalPendingTokens passed to shouldTriggerAsyncObservation.
    const currentTokens =
      contextWindowTokens ??
      (await this.tokenCounter.countMessagesAsync(unobservedMessages)) + (record.pendingMessageTokens ?? 0);
    ObservationalMemory.lastBufferedBoundary.set(bufferKey, currentTokens);

    // Set persistent flag so new instances (created per request) know buffering is in progress
    registerOp(record.id, 'bufferingObservation');
    this.storage.setBufferingObservationFlag(record.id, true, currentTokens).catch(err => {
      omError('[OM] Failed to set buffering observation flag', err);
    });

    // Start the async operation - waits for any existing op to complete first
    const asyncOp = this.runAsyncBufferedObservation(
      record,
      threadId,
      unobservedMessages,
      bufferKey,
      writer,
      requestContext,
    ).finally(() => {
      // Clean up the operation tracking
      ObservationalMemory.asyncBufferingOps.delete(bufferKey);
      // Clear persistent flag
      unregisterOp(record.id, 'bufferingObservation');
      this.storage.setBufferingObservationFlag(record.id, false).catch(err => {
        omError('[OM] Failed to clear buffering observation flag', err);
      });
    });

    ObservationalMemory.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Internal method that waits for existing buffering operation and then runs new buffering.
   * This implements the mutex-wait behavior.
   */
  private async runAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    bufferKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
  ): Promise<void> {
    // Wait for any existing buffering operation to complete first (mutex behavior)
    const existingOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
    if (existingOp) {
      try {
        await existingOp;
      } catch {
        // Previous op failed, continue with new one
      }
    }

    // Re-fetch record to get latest state after waiting
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    if (!freshRecord) {
      return;
    }

    // Determine the buffer cursor — the timestamp boundary beyond which we look for new messages.
    // Start from the static map (in-process), fall back to DB record (survives restarts).
    let bufferCursor = ObservationalMemory.lastBufferedAtTime.get(bufferKey) ?? freshRecord.lastBufferedAtTime ?? null;

    // Advance the cursor if lastObservedAt is newer (e.g. sync observation ran after the last buffer)
    if (freshRecord.lastObservedAt) {
      const lastObserved = new Date(freshRecord.lastObservedAt);
      if (!bufferCursor || lastObserved > bufferCursor) {
        bufferCursor = lastObserved;
      }
    }

    // Filter messages to only those newer than the buffer cursor.
    // This prevents re-buffering messages that were already included in a previous chunk,
    // even if their IDs were mutated by saveMessagesWithSealedIdTracking.
    let candidateMessages = this.getUnobservedMessages(unobservedMessages, freshRecord, {
      excludeBuffered: true,
    });
    const preFilterCount = candidateMessages.length;
    if (bufferCursor) {
      candidateMessages = candidateMessages.filter(msg => {
        if (!msg.createdAt) return true; // include messages without timestamps
        return new Date(msg.createdAt) > bufferCursor;
      });
    }

    omDebug(
      `[OM:bufferCursor] cursor=${bufferCursor?.toISOString() ?? 'null'}, unobserved=${unobservedMessages.length}, afterExcludeBuffered=${preFilterCount}, afterCursorFilter=${candidateMessages.length}`,
    );

    // Check if there's enough content to buffer
    const bufferTokens = this.observationConfig.bufferTokens ?? 5000;
    const minNewTokens = bufferTokens / 2;
    const newTokens = await this.tokenCounter.countMessagesAsync(candidateMessages);

    if (newTokens < minNewTokens) {
      return; // Not enough new content to buffer
    }

    const messagesToBuffer = candidateMessages;

    // Seal the messages being buffered to prevent new parts from being added.
    // This ensures that any streaming content after this point goes to new messages,
    // preserving the boundary of what we're buffering.
    this.sealMessagesForBuffering(messagesToBuffer);

    // CRITICAL: Persist the sealed messages to storage immediately.
    // This ensures that:
    // 1. The seal metadata (sealedAt on last part) is saved to the database
    // 2. When MessageList creates new messages for streaming content after the seal,
    //    those new messages have their own IDs and don't overwrite the sealed messages
    // 3. The sealed messages remain intact with their content at the time of buffering
    await this.messageHistory.persistMessages({
      messages: messagesToBuffer,
      threadId,
      resourceId: freshRecord.resourceId ?? undefined,
    });

    // Track sealed message IDs in the static map so saveMessagesWithSealedIdTracking
    // generates new IDs for any future saves of these messages.
    // Uses static map because async buffering runs in the background and the per-state
    // sealedIds set may belong to a different (already-finished) processInputStep call.
    let staticSealedIds = ObservationalMemory.sealedMessageIds.get(threadId);
    if (!staticSealedIds) {
      staticSealedIds = new Set<string>();
      ObservationalMemory.sealedMessageIds.set(threadId, staticSealedIds);
    }
    for (const msg of messagesToBuffer) {
      staticSealedIds.add(msg.id);
    }

    // Generate cycle ID and capture start time
    const cycleId = `buffer-obs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startedAt = new Date().toISOString();
    const tokensToBuffer = await this.tokenCounter.countMessagesAsync(messagesToBuffer);

    // Emit buffering start marker
    if (writer) {
      const startMarker = createBufferingStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToBuffer,
        recordId: freshRecord.id,
        threadId,
        threadIds: [threadId],
        config: this.getObservationMarkerConfig(),
      });
      void writer.custom(startMarker).catch(() => {});
    }

    try {
      omDebug(
        `[OM:bufferInput] cycleId=${cycleId}, msgCount=${messagesToBuffer.length}, msgTokens=${tokensToBuffer}, ids=${messagesToBuffer.map(m => `${m.id?.slice(0, 8)}@${m.createdAt ? new Date(m.createdAt).toISOString() : 'none'}`).join(',')}`,
      );
      await this.doAsyncBufferedObservation(
        freshRecord,
        threadId,
        messagesToBuffer,
        cycleId,
        startedAt,
        writer,
        requestContext,
      );

      // Update the buffer cursor so the next buffer only sees messages newer than this one.
      // Uses the same timestamp logic as the chunk's lastObservedAt (max message timestamp + 1ms).
      const maxTs = this.getMaxMessageTimestamp(messagesToBuffer);
      const cursor = new Date(maxTs.getTime() + 1);
      ObservationalMemory.lastBufferedAtTime.set(bufferKey, cursor);
    } catch (error) {
      // Emit buffering failed marker
      if (writer) {
        const failedMarker = createBufferingFailedMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensAttempted: tokensToBuffer,
          error: error instanceof Error ? error.message : String(error),
          recordId: freshRecord.id,
          threadId,
        });
        void writer.custom(failedMarker).catch(() => {});
        await this.persistMarkerToStorage(failedMarker, threadId, freshRecord.resourceId ?? undefined);
      }
      omError('[OM] Async buffered observation failed', error);
    }
  }

  /**
   * Perform async buffered observation - observes messages and stores to bufferedObservations.
   * Does NOT update activeObservations or trigger reflection.
   *
   * The observer sees: active observations + existing buffered observations + message history
   * (excluding already-buffered messages).
   */
  private async doAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    messagesToBuffer: MastraDBMessage[],
    cycleId: string,
    startedAt: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
  ): Promise<void> {
    // Build combined context for the observer: active + buffered chunk observations
    const bufferedChunks = this.getBufferedChunks(record);
    const bufferedChunksText = bufferedChunks.map(c => c.observations).join('\n\n');
    const combinedObservations = this.combineObservationsForBuffering(record.activeObservations, bufferedChunksText);

    // Call observer with combined context
    // Skip continuation hints during async buffering — they reflect the observer's
    // understanding at buffering time and become stale by activation.
    const result = await this.callObserver(
      combinedObservations,
      messagesToBuffer,
      undefined, // No abort signal for background ops
      { skipContinuationHints: true, requestContext },
    );

    // If the observer returned empty observations, skip buffering
    if (!result.observations) {
      omDebug(`[OM:doAsyncBufferedObservation] empty observations returned, skipping buffer storage`);
      return;
    }

    // Get the new observations to buffer (just the new content, not merged)
    // The storage adapter will handle appending to existing buffered content
    let newObservations: string;
    if (this.scope === 'resource') {
      newObservations = await this.wrapWithThreadTag(threadId, result.observations);
    } else {
      newObservations = result.observations;
    }

    const newTokenCount = this.tokenCounter.countObservations(newObservations);

    // Just pass the new message IDs - storage adapter will merge with existing
    const newMessageIds = messagesToBuffer.map(m => m.id);
    const messageTokens = await this.tokenCounter.countMessagesAsync(messagesToBuffer);

    // lastObservedAt should be the timestamp of the latest message being buffered (+1ms for exclusive)
    // This ensures new messages created after buffering are still considered unobserved
    const maxMessageTimestamp = this.getMaxMessageTimestamp(messagesToBuffer);
    const lastObservedAt = new Date(maxMessageTimestamp.getTime() + 1);

    // Store as a new buffered chunk (storage adapter appends to existing chunks)
    await this.storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId,
        observations: newObservations,
        tokenCount: newTokenCount,
        messageIds: newMessageIds,
        messageTokens,
        lastObservedAt,
        suggestedContinuation: result.suggestedContinuation,
        currentTask: result.currentTask,
      },
      lastBufferedAtTime: lastObservedAt,
    });

    // Emit buffering end marker
    if (writer) {
      const tokensBuffered = await this.tokenCounter.countMessagesAsync(messagesToBuffer);
      // Re-fetch record to get total buffered tokens after storage update
      const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      const updatedChunks = this.getBufferedChunks(updatedRecord);
      const totalBufferedTokens = updatedChunks.reduce((sum, c) => sum + (c.tokenCount ?? 0), 0) || newTokenCount;
      const endMarker = createBufferingEndMarker({
        cycleId,
        operationType: 'observation',
        startedAt,
        tokensBuffered,
        bufferedTokens: totalBufferedTokens,
        recordId: record.id,
        threadId,
        observations: newObservations,
      });
      void writer.custom(endMarker).catch(() => {});
      // Persist so the badge state survives page reload even if the stream is already closed
      await this.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
    }
  }

  /**
   * Combine active and buffered observations for the buffering observer context.
   * The buffering observer needs to see both so it doesn't duplicate content.
   */
  private combineObservationsForBuffering(
    activeObservations: string | undefined,
    bufferedObservations: string | undefined,
  ): string | undefined {
    if (!activeObservations && !bufferedObservations) {
      return undefined;
    }
    if (!activeObservations) {
      return bufferedObservations;
    }
    if (!bufferedObservations) {
      return activeObservations;
    }
    // Both exist - combine them with a clear separator
    return `${activeObservations}\n\n--- BUFFERED (pending activation) ---\n\n${bufferedObservations}`;
  }

  /**
   * Try to activate buffered observations when threshold is reached.
   * Returns true if activation succeeded, false if no buffered content or activation failed.
   *
   * @param record - Current OM record
   * @param lockKey - Lock key for this scope
   * @param writer - Optional writer for emitting UI markers
   */
  private async tryActivateBufferedObservations(
    record: ObservationalMemoryRecord,
    lockKey: string,
    currentPendingTokens: number,
    writer?: ProcessInputStepArgs['writer'],
    messageList?: MessageList,
  ): Promise<{
    success: boolean;
    updatedRecord?: ObservationalMemoryRecord;
    messageTokensActivated?: number;
    activatedMessageIds?: string[];
    suggestedContinuation?: string;
    currentTask?: string;
  }> {
    // Check if there's buffered content to activate
    const chunks = this.getBufferedChunks(record);
    omDebug(`[OM:tryActivate] chunks=${chunks.length}, recordId=${record.id}`);
    if (!chunks.length) {
      omDebug(`[OM:tryActivate] no chunks, returning false`);
      return { success: false };
    }

    const bufferKey = this.getObservationBufferKey(lockKey);

    // Wait for any in-progress async buffering to complete (with timeout)
    // Use 60s timeout - buffering can take a while for large message batches
    const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
    if (asyncOp) {
      try {
        await Promise.race([
          asyncOp,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60_000)),
        ]);
      } catch {
        // Timeout or error - proceed with what we have
      }
    }

    // Re-fetch record to get latest buffered content
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    if (!freshRecord) {
      return { success: false };
    }
    const rawFreshChunks = this.getBufferedChunks(freshRecord);
    if (!rawFreshChunks.length) {
      return { success: false };
    }

    // Re-check whether activation is still needed. A previous activation on this
    // turn (or an in-flight buffering op that just completed) may have already
    // brought us well below the threshold. Activating unnecessarily invalidates
    // the prompt cache, so we skip if we're already under the threshold.
    const messageTokensThreshold = getMaxThreshold(this.observationConfig.messageTokens);
    let effectivePendingTokens = currentPendingTokens;
    if (messageList) {
      effectivePendingTokens = await this.tokenCounter.countMessagesAsync(messageList.get.all.db());
      if (effectivePendingTokens < messageTokensThreshold) {
        omDebug(
          `[OM:tryActivate] skipping activation: freshPendingTokens=${effectivePendingTokens} < threshold=${messageTokensThreshold}`,
        );
        return { success: false };
      }
    }

    // Refresh chunk token weights from the current message list so projection
    // math uses accurate values instead of stale buffering-time snapshots.
    const freshChunks = messageList
      ? this.refreshBufferedChunkMessageTokens(rawFreshChunks, messageList)
      : rawFreshChunks;

    // Perform partial swap with bufferActivation
    const bufferActivation = this.observationConfig.bufferActivation ?? 0.7;
    const activationRatio = resolveActivationRatio(bufferActivation, messageTokensThreshold);

    // When above blockAfter, prefer the over boundary to reduce context, while still
    // respecting the minimum remaining tokens safeguard.
    const forceMaxActivation = !!(
      this.observationConfig.blockAfter && effectivePendingTokens >= this.observationConfig.blockAfter
    );

    const bufferTokens = this.observationConfig.bufferTokens ?? 0;
    const retentionFloor = resolveRetentionFloor(bufferActivation, messageTokensThreshold);
    const projectedMessageRemoval = calculateProjectedMessageRemoval(
      freshChunks,
      bufferActivation,
      messageTokensThreshold,
      effectivePendingTokens,
    );
    const projectedRemaining = Math.max(0, effectivePendingTokens - projectedMessageRemoval);
    const maxRemaining = retentionFloor + bufferTokens;

    if (!forceMaxActivation && bufferTokens > 0 && projectedRemaining > maxRemaining) {
      omDebug(
        `[OM:tryActivate] skipping activation: projectedRemaining=${projectedRemaining} > maxRemaining=${maxRemaining} (retentionFloor=${retentionFloor}, bufferTokens=${bufferTokens})`,
      );
      return { success: false };
    }

    omDebug(
      `[OM:tryActivate] swapping: freshChunks=${freshChunks.length}, bufferActivation=${bufferActivation}, activationRatio=${activationRatio}, forceMax=${forceMaxActivation}, totalChunkTokens=${freshChunks.reduce((s, c) => s + (c.tokenCount ?? 0), 0)}`,
    );
    const activationResult = await this.storage.swapBufferedToActive({
      id: freshRecord.id,
      activationRatio,
      messageTokensThreshold,
      currentPendingTokens: effectivePendingTokens,
      forceMaxActivation,
      bufferedChunks: freshChunks,
    });
    omDebug(
      `[OM:tryActivate] swapResult: chunksActivated=${activationResult.chunksActivated}, tokensActivated=${activationResult.messageTokensActivated}, obsTokensActivated=${activationResult.observationTokensActivated}, activatedCycleIds=${activationResult.activatedCycleIds.join(',')}`,
    );

    // Clear the buffering flag but do NOT reset lastBufferedBoundary here.
    // The caller sets the boundary to the post-activation context size so that
    // interval tracking continues from the correct position. Deleting it here
    // would reset to 0 and cause the next step to immediately re-trigger buffering.
    await this.storage.setBufferingObservationFlag(freshRecord.id, false);
    unregisterOp(freshRecord.id, 'bufferingObservation');

    // Fetch updated record
    const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    // Emit activation markers for UI feedback - one per activated cycleId
    // Each marker gets its own chunk's data so the UI shows per-chunk breakdowns
    if (writer && updatedRecord && activationResult.activatedCycleIds.length > 0) {
      const perChunkMap = new Map(activationResult.perChunk?.map(c => [c.cycleId, c]));
      for (const cycleId of activationResult.activatedCycleIds) {
        const chunkData = perChunkMap.get(cycleId);
        const activationMarker = createActivationMarker({
          cycleId, // Use the original buffering cycleId so UI can link them
          operationType: 'observation',
          chunksActivated: 1,
          tokensActivated: chunkData?.messageTokens ?? activationResult.messageTokensActivated,
          observationTokens: chunkData?.observationTokens ?? activationResult.observationTokensActivated,
          messagesActivated: chunkData?.messageCount ?? activationResult.messagesActivated,
          recordId: updatedRecord.id,
          threadId: updatedRecord.threadId ?? record.threadId ?? '',
          generationCount: updatedRecord.generationCount ?? 0,
          observations: chunkData?.observations ?? activationResult.observations,
          config: this.getObservationMarkerConfig(),
        });
        void writer.custom(activationMarker).catch(() => {});
        await this.persistMarkerToMessage(
          activationMarker,
          messageList,
          record.threadId ?? '',
          record.resourceId ?? undefined,
        );
      }
    }

    return {
      success: true,
      updatedRecord: updatedRecord ?? undefined,
      messageTokensActivated: activationResult.messageTokensActivated,
      activatedMessageIds: activationResult.activatedMessageIds,
      suggestedContinuation: activationResult.suggestedContinuation,
      currentTask: activationResult.currentTask,
    };
  }

  /**
   * Start an async background reflection that stores results to bufferedReflection.
   * This is a fire-and-forget operation that runs in the background.
   * The results will be swapped to active when the main reflection threshold is reached.
   *
   * @param record - Current OM record
   * @param observationTokens - Current observation token count
   * @param lockKey - Lock key for this scope
   */
  private startAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    lockKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
  ): void {
    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Don't start if already in progress
    if (this.isAsyncBufferingInProgress(bufferKey)) {
      return;
    }

    // Update the last buffered boundary (in-memory for current instance)
    ObservationalMemory.lastBufferedBoundary.set(bufferKey, observationTokens);

    // Set persistent flag so new instances know buffering is in progress
    registerOp(record.id, 'bufferingReflection');
    this.storage.setBufferingReflectionFlag(record.id, true).catch(err => {
      omError('[OM] Failed to set buffering reflection flag', err);
    });

    // Start the async operation
    const asyncOp = this.doAsyncBufferedReflection(record, bufferKey, writer, requestContext)
      .catch(async error => {
        // Emit buffering failed marker
        if (writer) {
          const failedMarker = createBufferingFailedMarker({
            cycleId: `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            operationType: 'reflection',
            startedAt: new Date().toISOString(),
            tokensAttempted: observationTokens,
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId: record.threadId ?? '',
          });
          void writer.custom(failedMarker).catch(() => {});
          await this.persistMarkerToStorage(failedMarker, record.threadId ?? '', record.resourceId ?? undefined);
        }
        // Log but don't crash - async buffering failure is recoverable
        omError('[OM] Async buffered reflection failed', error);
      })
      .finally(() => {
        // Clean up the operation tracking
        ObservationalMemory.asyncBufferingOps.delete(bufferKey);
        // Clear persistent flag
        unregisterOp(record.id, 'bufferingReflection');
        this.storage.setBufferingReflectionFlag(record.id, false).catch(err => {
          omError('[OM] Failed to clear buffering reflection flag', err);
        });
      });

    ObservationalMemory.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Perform async buffered reflection - reflects observations and stores to bufferedReflection.
   * Does NOT create a new generation or update activeObservations.
   */
  private async doAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    _bufferKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
  ): Promise<void> {
    // Re-fetch the record to get the latest observation token count.
    // The record passed in may be stale if sync observation just ran.
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const currentRecord = freshRecord ?? record;
    const observationTokens = currentRecord.observationTokenCount ?? 0;
    const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
    const bufferActivation = this.reflectionConfig.bufferActivation ?? 0.5;
    const startedAt = new Date().toISOString();
    const cycleId = `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Store cycleId so tryActivateBufferedReflection can use it for UI markers
    ObservationalMemory.reflectionBufferCycleIds.set(_bufferKey, cycleId);

    // Slice activeObservations to only the first N lines that fit within the
    // activation-point token budget. This keeps the reflector prompt small
    // (avoiding LLM hangs on huge prompts) and matches the portion that will
    // be replaced at activation time.
    const fullObservations = currentRecord.activeObservations ?? '';
    const allLines = fullObservations.split('\n');
    const totalLines = allLines.length;

    // Calculate how many lines fit within the activation point budget
    const avgTokensPerLine = totalLines > 0 ? observationTokens / totalLines : 0;
    const activationPointTokens = reflectThreshold * bufferActivation;
    const linesToReflect =
      avgTokensPerLine > 0 ? Math.min(Math.floor(activationPointTokens / avgTokensPerLine), totalLines) : totalLines;

    const activeObservations = allLines.slice(0, linesToReflect).join('\n');
    const reflectedObservationLineCount = linesToReflect;
    const sliceTokenEstimate = Math.round(avgTokensPerLine * linesToReflect);
    // Compression target: ask for 75% of the slice size. This is a modest reduction
    // that LLMs can reliably achieve on dense observation text, unlike the more
    // aggressive bufferActivation ratio which often fails on already-compressed content.
    const compressionTarget = Math.round(sliceTokenEstimate * 0.75);

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: slicing observations for reflection — totalLines=${totalLines}, avgTokPerLine=${avgTokensPerLine.toFixed(1)}, activationPointTokens=${activationPointTokens}, linesToReflect=${linesToReflect}/${totalLines}, sliceTokenEstimate=${sliceTokenEstimate}, compressionTarget=${compressionTarget}`,
    );

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: starting reflector call, recordId=${currentRecord.id}, observationTokens=${sliceTokenEstimate}, compressionTarget=${compressionTarget} (inputTokens), activeObsLength=${activeObservations.length}, reflectedLineCount=${reflectedObservationLineCount}`,
    );

    // Emit buffering start marker (after slice so we report the actual token count)
    if (writer) {
      const startMarker = createBufferingStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToBuffer: sliceTokenEstimate,
        recordId: record.id,
        threadId: record.threadId ?? '',
        threadIds: record.threadId ? [record.threadId] : [],
        config: this.getObservationMarkerConfig(),
      });
      void writer.custom(startMarker).catch(() => {});
    }

    // Call reflector with compression target.
    // Start at compression level 1 (standard guidance), retry at level 2 (aggressive).
    const reflectResult = await this.callReflector(
      activeObservations,
      undefined, // No manual prompt
      undefined, // No stream context for background ops
      compressionTarget,
      undefined, // No abort signal for background ops
      true, // Skip continuation hints for async buffering
      1, // Start at compression level 1 for buffered reflection
      requestContext,
    );

    const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: reflector returned ${reflectionTokenCount} tokens (${reflectResult.observations?.length} chars), saving to recordId=${currentRecord.id}`,
    );

    // Store to bufferedReflection along with the line boundary
    await this.storage.updateBufferedReflection({
      id: currentRecord.id,
      reflection: reflectResult.observations,
      tokenCount: reflectionTokenCount,
      inputTokenCount: sliceTokenEstimate,
      reflectedObservationLineCount,
    });
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: bufferedReflection saved with lineCount=${reflectedObservationLineCount}`,
    );

    // Emit buffering end marker
    if (writer) {
      const endMarker = createBufferingEndMarker({
        cycleId,
        operationType: 'reflection',
        startedAt,
        tokensBuffered: sliceTokenEstimate,
        bufferedTokens: reflectionTokenCount,
        recordId: currentRecord.id,
        threadId: currentRecord.threadId ?? '',
        observations: reflectResult.observations,
      });
      void writer.custom(endMarker).catch(() => {});
      // Persist so the badge state survives page reload even if the stream is already closed
      await this.persistMarkerToStorage(endMarker, currentRecord.threadId ?? '', currentRecord.resourceId ?? undefined);
    }
  }

  /**
   * Try to activate buffered reflection when threshold is reached.
   * Returns true if activation succeeded, false if no buffered content or activation failed.
   *
   * @param record - Current OM record
   * @param lockKey - Lock key for this scope
   */
  private async tryActivateBufferedReflection(
    record: ObservationalMemoryRecord,
    lockKey: string,
    writer?: ProcessorStreamWriter,
    messageList?: MessageList,
  ): Promise<boolean> {
    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Wait for any in-flight async reflection before checking DB state.
    // The passed-in record may be stale — the async reflector could have
    // saved results between when the record was fetched and now.
    const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
    if (asyncOp) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: waiting for in-progress op...`);
      try {
        await Promise.race([
          asyncOp,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60_000)),
        ]);
      } catch {
        // Timeout or error - proceed with what we have
      }
    }

    // Fetch the latest record — either the async op just completed, or we
    // need the freshest DB state to check for buffered reflection content.
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: recordId=${record.id}, hasBufferedReflection=${!!freshRecord?.bufferedReflection}, bufferedReflectionLen=${freshRecord?.bufferedReflection?.length ?? 0}`,
    );
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: freshRecord.id=${freshRecord?.id}, freshBufferedReflection=${freshRecord?.bufferedReflection ? 'present (' + freshRecord.bufferedReflection.length + ' chars)' : 'empty'}, freshObsTokens=${freshRecord?.observationTokenCount}`,
    );

    if (!freshRecord?.bufferedReflection) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: no buffered reflection after re-fetch, returning false`);
      return false;
    }

    const beforeTokens = freshRecord.observationTokenCount ?? 0;

    // Compute the combined token count for the new activeObservations.
    // Replicate the merge logic: bufferedReflection + unreflected lines after the boundary.
    const reflectedLineCount = freshRecord.reflectedObservationLineCount ?? 0;
    const currentObservations = freshRecord.activeObservations ?? '';
    const allLines = currentObservations.split('\n');
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join('\n').trim();
    const combinedObservations = unreflectedContent
      ? `${freshRecord.bufferedReflection}\n\n${unreflectedContent}`
      : freshRecord.bufferedReflection!;
    const combinedTokenCount = this.tokenCounter.countObservations(combinedObservations);

    // Swap buffered reflection to active. The storage adapter uses the stored
    // reflectedObservationLineCount to split: reflected lines → replaced by bufferedReflection,
    // unreflected lines (added after reflection) → appended as-is.
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activating, beforeTokens=${beforeTokens}, combinedTokenCount=${combinedTokenCount}, reflectedLineCount=${reflectedLineCount}, unreflectedLines=${unreflectedLines.length}`,
    );
    await this.storage.swapBufferedReflectionToActive({
      currentRecord: freshRecord,
      tokenCount: combinedTokenCount,
    });

    // Reset lastBufferedBoundary so new reflection buffering can start fresh
    ObservationalMemory.lastBufferedBoundary.delete(bufferKey);

    // Emit activation marker using the original buffering cycleId so the UI can match it
    const afterRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const afterTokens = afterRecord?.observationTokenCount ?? 0;
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activation complete! beforeTokens=${beforeTokens}, afterTokens=${afterTokens}, newRecordId=${afterRecord?.id}, newGenCount=${afterRecord?.generationCount}`,
    );

    if (writer) {
      const originalCycleId = ObservationalMemory.reflectionBufferCycleIds.get(bufferKey);
      const activationMarker = createActivationMarker({
        cycleId: originalCycleId ?? `reflect-act-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: beforeTokens,
        observationTokens: afterTokens,
        messagesActivated: 0,
        recordId: freshRecord.id,
        threadId: freshRecord.threadId ?? '',
        generationCount: afterRecord?.generationCount ?? freshRecord.generationCount ?? 0,
        observations: afterRecord?.activeObservations,
        config: this.getObservationMarkerConfig(),
      });
      void writer.custom(activationMarker).catch(() => {});
      await this.persistMarkerToMessage(
        activationMarker,
        messageList,
        freshRecord.threadId ?? '',
        freshRecord.resourceId ?? undefined,
      );
    }

    // Clean up the stored cycleId
    ObservationalMemory.reflectionBufferCycleIds.delete(bufferKey);

    return true;
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
  private async doResourceScopedObservation(opts: {
    record: ObservationalMemoryRecord;
    currentThreadId: string;
    resourceId: string;
    currentThreadMessages: MastraDBMessage[];
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const {
      record,
      currentThreadId,
      resourceId,
      currentThreadMessages,
      writer,
      abortSignal,
      reflectionHooks,
      requestContext,
    } = opts;
    // Clear debug entries at start of observation cycle

    // ════════════════════════════════════════════════════════════
    // PER-THREAD CURSORS: Load unobserved messages for each thread using its own lastObservedAt
    // This prevents message loss when threads have different observation progress
    // ════════════════════════════════════════════════════════════

    // First, get all threads for this resource to access their per-thread lastObservedAt
    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId } });
    const threadMetadataMap = new Map<string, { lastObservedAt?: string }>();

    for (const thread of allThreads) {
      const omMetadata = getThreadOMMetadata(thread.metadata);
      threadMetadataMap.set(thread.id, { lastObservedAt: omMetadata?.lastObservedAt });
    }

    // Load messages per-thread using each thread's own cursor
    const messagesByThread = new Map<string, MastraDBMessage[]>();

    for (const thread of allThreads) {
      const threadLastObservedAt = threadMetadataMap.get(thread.id)?.lastObservedAt;

      // Query messages for this specific thread AFTER its lastObservedAt
      // Add 1ms to make the filter exclusive (since dateRange.start is inclusive)
      // This prevents re-observing the same messages
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      if (result.messages.length > 0) {
        messagesByThread.set(thread.id, result.messages);
      }
    }

    // Handle current thread messages (may not be in DB yet)
    // Merge with any DB messages for the current thread
    if (currentThreadMessages.length > 0) {
      const existingCurrentThreadMsgs = messagesByThread.get(currentThreadId) ?? [];
      const messageMap = new Map<string, MastraDBMessage>();

      // Add DB messages first
      for (const msg of existingCurrentThreadMsgs) {
        if (msg.id) messageMap.set(msg.id, msg);
      }

      // Add/override with current thread messages (they're more up-to-date)
      for (const msg of currentThreadMessages) {
        if (msg.id) messageMap.set(msg.id, msg);
      }

      messagesByThread.set(currentThreadId, Array.from(messageMap.values()));
    }

    // Filter out messages already observed in this instance's lifetime.
    // This can happen when doResourceScopedObservation re-queries the DB using per-thread
    // lastObservedAt cursors that haven't fully advanced past messages observed in a prior cycle.
    for (const [tid, msgs] of messagesByThread) {
      const filtered = msgs.filter(m => !this.observedMessageIds.has(m.id));
      if (filtered.length > 0) {
        messagesByThread.set(tid, filtered);
      } else {
        messagesByThread.delete(tid);
      }
    }
    // Count total messages
    let totalMessages = 0;
    for (const msgs of messagesByThread.values()) {
      totalMessages += msgs.length;
    }

    if (totalMessages === 0) {
      return;
    }

    // ════════════════════════════════════════════════════════════
    // THREAD SELECTION: Pick which threads to observe based on token threshold
    // - Sort by largest threads first (most messages = most value per Observer call)
    // - Accumulate until we hit the threshold
    // - This prevents making many small Observer calls for 1-message threads
    // ════════════════════════════════════════════════════════════
    const threshold = getMaxThreshold(this.observationConfig.messageTokens);

    // Calculate tokens per thread and sort by size (largest first)
    const threadTokenCounts = new Map<string, number>();
    for (const [threadId, msgs] of messagesByThread) {
      const tokens = await this.tokenCounter.countMessagesAsync(msgs);
      threadTokenCounts.set(threadId, tokens);
    }

    const threadsBySize = Array.from(messagesByThread.keys()).sort((a, b) => {
      return (threadTokenCounts.get(b) ?? 0) - (threadTokenCounts.get(a) ?? 0);
    });

    // Select threads to observe until we hit the threshold
    let accumulatedTokens = 0;
    const threadsToObserve: string[] = [];

    for (const threadId of threadsBySize) {
      const threadTokens = threadTokenCounts.get(threadId) ?? 0;

      // If we've already accumulated enough, stop adding threads
      if (accumulatedTokens >= threshold) {
        break;
      }

      threadsToObserve.push(threadId);
      accumulatedTokens += threadTokens;
    }

    if (threadsToObserve.length === 0) {
      return;
    }

    // Now sort the selected threads by oldest message for consistent observation order
    const threadOrder = this.sortThreadsByOldestMessage(
      new Map(threadsToObserve.map(tid => [tid, messagesByThread.get(tid) ?? []])),
    );

    // Debug: Log message counts per thread and date ranges

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // Another request may have already observed while we were loading messages
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);
    registerOp(record.id, 'observing');

    // Generate unique cycle ID for this observation cycle
    // This ties together the start/end/failed markers across all threads
    const cycleId = crypto.randomUUID();

    // Declare variables outside try block so they're accessible in catch
    const threadsWithMessages = new Map<string, MastraDBMessage[]>();
    const threadTokensToObserve = new Map<string, number>();
    let observationStartedAt = '';

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(null, resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          return;
        }
      }

      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';

      // ═════════════════════════════════════════���══════════════════
      // BATCHED MULTI-THREAD OBSERVATION: Single Observer call for all threads
      // This is much more efficient than calling the Observer for each thread individually
      // ════════════════════════════════════════════════════════════

      // Filter to only threads with messages
      for (const threadId of threadOrder) {
        const msgs = messagesByThread.get(threadId);
        if (msgs && msgs.length > 0) {
          threadsWithMessages.set(threadId, msgs);
        }
      }

      // Emit debug event for observation triggered (combined for all threads)
      this.emitDebugEvent({
        type: 'observation_triggered',
        timestamp: new Date(),
        threadId: threadOrder.join(','),
        resourceId,
        previousObservations: existingObservations,
        messages: Array.from(threadsWithMessages.values())
          .flat()
          .map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
      });

      // ════════════════════════════════════════════════════════════════════════
      // INSERT START MARKERS before observation
      // Each thread gets its own start marker in its last message
      // ════════════════════════════════════════════════════════════════════════
      observationStartedAt = new Date().toISOString();
      const allThreadIds = Array.from(threadsWithMessages.keys());

      for (const [threadId, msgs] of threadsWithMessages) {
        const lastMessage = msgs[msgs.length - 1];
        const tokensToObserve = await this.tokenCounter.countMessagesAsync(msgs);
        threadTokensToObserve.set(threadId, tokensToObserve);

        if (lastMessage?.id) {
          const startMarker = createObservationStartMarker({
            cycleId,
            operationType: 'observation',
            tokensToObserve,
            recordId: record.id,
            threadId,
            threadIds: allThreadIds,
            config: this.getObservationMarkerConfig(),
          });
          // Stream the start marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(startMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then add to message (skipPush since writer.custom already added the part)
        }
      }

      // ════════════════════════════════════════════════════════════
      // PARALLEL BATCHING: Chunk threads into batches and process in parallel
      // This combines batching efficiency with parallel execution
      // ════��═══════════════════════════════════════════════════════
      const maxTokensPerBatch =
        this.observationConfig.maxTokensPerBatch ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch;
      const orderedThreadIds = threadOrder.filter(tid => threadsWithMessages.has(tid));

      // Chunk threads into batches based on token count
      const batches: Array<{ threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> }> = [];
      let currentBatch: { threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> } = {
        threadIds: [],
        threadMap: new Map(),
      };
      let currentBatchTokens = 0;

      for (const threadId of orderedThreadIds) {
        const msgs = threadsWithMessages.get(threadId)!;
        const threadTokens = threadTokenCounts.get(threadId) ?? 0;

        // If adding this thread would exceed the batch limit, start a new batch
        // (unless the current batch is empty - always include at least one thread)
        if (currentBatchTokens + threadTokens > maxTokensPerBatch && currentBatch.threadIds.length > 0) {
          batches.push(currentBatch);
          currentBatch = { threadIds: [], threadMap: new Map() };
          currentBatchTokens = 0;
        }

        currentBatch.threadIds.push(threadId);
        currentBatch.threadMap.set(threadId, msgs);
        currentBatchTokens += threadTokens;
      }

      // Don't forget the last batch
      if (currentBatch.threadIds.length > 0) {
        batches.push(currentBatch);
      }

      // Process batches in parallel
      const batchPromises = batches.map(async batch => {
        const batchResult = await this.callMultiThreadObserver(
          existingObservations,
          batch.threadMap,
          batch.threadIds,
          abortSignal,
          requestContext,
        );
        return batchResult;
      });

      const batchResults = await Promise.all(batchPromises);

      // Merge all batch results into a single map and accumulate usage
      const multiThreadResults = new Map<
        string,
        {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
        }
      >();
      let totalBatchUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      for (const batchResult of batchResults) {
        for (const [threadId, result] of batchResult.results) {
          multiThreadResults.set(threadId, result);
        }
        // Accumulate usage from each batch
        if (batchResult.usage) {
          totalBatchUsage.inputTokens += batchResult.usage.inputTokens ?? 0;
          totalBatchUsage.outputTokens += batchResult.usage.outputTokens ?? 0;
          totalBatchUsage.totalTokens += batchResult.usage.totalTokens ?? 0;
        }
      }

      // Convert to the expected format for downstream processing
      const observationResults: Array<{
        threadId: string;
        threadMessages: MastraDBMessage[];
        result: {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
        };
      } | null> = [];

      for (const threadId of threadOrder) {
        const threadMessages = messagesByThread.get(threadId) ?? [];
        if (threadMessages.length === 0) continue;

        const result = multiThreadResults.get(threadId);
        if (!result) {
          continue;
        }

        // Debug: Log Observer output for this thread

        observationResults.push({
          threadId,
          threadMessages,
          result,
        });
      }

      // Combine results: wrap each thread's observations and append to existing
      let currentObservations = existingObservations;
      let cycleObservationTokens = 0; // Track total new observation tokens generated in this cycle

      for (const obsResult of observationResults) {
        if (!obsResult) continue;

        const { threadId, threadMessages, result } = obsResult;

        // Track tokens generated for this thread
        cycleObservationTokens += this.tokenCounter.countObservations(result.observations);

        // Wrap with thread tag and append (in thread order for consistency)
        const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
        currentObservations = this.replaceOrAppendThreadSection(currentObservations, threadId, threadSection);

        // Update thread-specific metadata:
        // - lastObservedAt: ALWAYS update to track per-thread observation progress
        // - currentTask, suggestedResponse: explicitly clear when omitted to avoid stale hints
        const threadLastObservedAt = this.getMaxMessageTimestamp(threadMessages);
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            lastObservedAt: threadLastObservedAt.toISOString(),
            suggestedResponse: result.suggestedContinuation,
            currentTask: result.currentTask,
            lastObservedMessageCursor: this.getLastObservedMessageCursor(threadMessages),
          });
          await this.storage.updateThread({
            id: threadId,
            title: thread.title ?? '',
            metadata: newMetadata,
          });
        }

        // Emit debug event for observation complete (usage is for the entire batch, added to first thread only)
        const isFirstThread = observationResults.indexOf(obsResult) === 0;
        this.emitDebugEvent({
          type: 'observation_complete',
          timestamp: new Date(),
          threadId,
          resourceId,
          observations: threadSection,
          rawObserverOutput: result.observations,
          previousObservations: record.activeObservations,
          messages: threadMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          // Add batch usage to first thread's event only (to avoid double-counting)
          usage: isFirstThread && totalBatchUsage.totalTokens > 0 ? totalBatchUsage : undefined,
        });
      }

      // After ALL threads observed, update the record with final observations
      let totalTokenCount = this.tokenCounter.countObservations(currentObservations);

      // Compute global lastObservedAt as a "high water mark" across all threads
      // Note: Per-thread cursors (stored in ThreadOMMetadata.lastObservedAt) are the authoritative source
      // for determining which messages each thread has observed. This global value is used for:
      // - Quick concurrency checks (has any observation happened since we started?)
      // - Thread-scoped observation (non-resource scope)
      const observedMessages = observationResults
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .flatMap(r => r.threadMessages);
      const lastObservedAt = this.getMaxMessageTimestamp(observedMessages);

      // Collect message IDs being observed for the safeguard
      const newMessageIds = observedMessages.map(m => m.id);
      const existingIds = record.observedMessageIds ?? [];
      const allObservedIds = [...new Set([...existingIds, ...newMessageIds])];

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: currentObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        observedMessageIds: allObservedIds,
      });

      // ════════════════════════════════════════════════════════════════════════
      // INSERT END MARKERS into each thread's last message
      // This completes the observation boundary (start markers were inserted above)
      // ════════════════════════════════════════════════════════════════════════
      for (const obsResult of observationResults) {
        if (!obsResult) continue;
        const { threadId, threadMessages, result } = obsResult;
        const lastMessage = threadMessages[threadMessages.length - 1];
        if (lastMessage?.id) {
          const tokensObserved =
            threadTokensToObserve.get(threadId) ?? (await this.tokenCounter.countMessagesAsync(threadMessages));
          const endMarker = createObservationEndMarker({
            cycleId,
            operationType: 'observation',
            startedAt: observationStartedAt,
            tokensObserved,
            observationTokens: cycleObservationTokens,
            observations: result.observations,
            currentTask: result.currentTask,
            suggestedResponse: result.suggestedContinuation,
            recordId: record.id,
            threadId,
          });

          // Stream the end marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(endMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then seal the message (skipPush since writer.custom already added the part)
        }
      }

      // Check for reflection AFTER all threads are observed
      await this.maybeReflect({
        record: { ...record, activeObservations: currentObservations },
        observationTokens: totalTokenCount,
        threadId: currentThreadId,
        writer,
        abortSignal,
        reflectionHooks,
        requestContext,
      });
    } catch (error) {
      // Insert FAILED markers into each thread's last message on error
      for (const [threadId, msgs] of threadsWithMessages) {
        const lastMessage = msgs[msgs.length - 1];
        if (lastMessage?.id) {
          const tokensAttempted = threadTokensToObserve.get(threadId) ?? 0;
          const failedMarker = createObservationFailedMarker({
            cycleId,
            operationType: 'observation',
            startedAt: observationStartedAt,
            tokensAttempted,
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId,
          });

          // Stream the failed marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(failedMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then seal the message (skipPush since writer.custom already added the part)
        }
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - observation failure should not crash the agent
      omError('[OM] Resource-scoped observation failed', error);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
      unregisterOp(record.id, 'observing');
    }
  }

  /**
   * Check if reflection needed and trigger if so.
   * Supports both synchronous reflection and async buffered reflection.
   * When async buffering is enabled via `bufferTokens`, reflection is triggered
   * in the background at intervals, and activated when the threshold is reached.
   */
  private async maybeReflect(opts: {
    record: ObservationalMemoryRecord;
    observationTokens: number;
    threadId?: string;
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    messageList?: MessageList;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { record, observationTokens, writer, abortSignal, messageList, reflectionHooks, requestContext } = opts;
    const lockKey = this.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC BUFFERING: Trigger background reflection at bufferActivation ratio
    // This runs in the background and stores results to bufferedReflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled() && observationTokens < reflectThreshold) {
      // Check if we've crossed the bufferActivation threshold
      // (inlined from shouldTriggerAsyncReflection — that method moved to the processor)
      const shouldTrigger = (() => {
        if (!this.isAsyncReflectionEnabled()) return false;
        if (record.isBufferingReflection) {
          if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
          omDebug(`[OM:shouldTriggerAsyncRefl] isBufferingReflection=true but stale, clearing`);
          this.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
        }
        const bufferKey = this.getReflectionBufferKey(lockKey);
        if (this.isAsyncBufferingInProgress(bufferKey)) return false;
        if (ObservationalMemory.lastBufferedBoundary.has(bufferKey)) return false;
        if (record.bufferedReflection) return false;
        const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;
        return observationTokens >= activationPoint;
      })();
      if (shouldTrigger) {
        // Start background reflection (fire-and-forget)
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
      }
    }

    // Check if we've reached the reflection threshold
    if (observationTokens <= reflectThreshold) {
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // If the DB flag is set but this process isn't actively reflecting,
    // the flag is stale (from a crashed process) — clear it and proceed.
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) {
        omDebug(`[OM:reflect] isReflecting=true and active in this process, skipping`);
        return;
      }
      omDebug(`[OM:reflect] isReflecting=true but NOT active in this process — stale flag from dead process, clearing`);
      await this.storage.setReflectingFlag(record.id, false);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC ACTIVATION: Try to activate buffered reflection first
    // If async buffering was enabled and we have buffered content, activate it.
    // This provides instant activation without blocking on new reflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled()) {
      const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer, messageList);
      if (activationSuccess) {
        // Buffered reflection was activated - we're done
        return;
      }
      // No buffered content or activation failed.
      // When async is enabled, only fall through to sync if blockAfter is set and exceeded.
      if (this.reflectionConfig.blockAfter && observationTokens >= this.reflectionConfig.blockAfter) {
        omDebug(
          `[OM:reflect] blockAfter exceeded (${observationTokens} >= ${this.reflectionConfig.blockAfter}), falling through to sync reflection`,
        );
      } else {
        omDebug(
          `[OM:reflect] async activation failed, no blockAfter or below it (obsTokens=${observationTokens}, blockAfter=${this.reflectionConfig.blockAfter}) — starting background reflection`,
        );
        // Start background reflection so it's ready for next activation attempt
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
        return;
      }
    }

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    reflectionHooks?.onReflectionStart?.();
    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    // Generate unique cycle ID for this reflection
    const cycleId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const threadId = opts.threadId ?? 'unknown';

    // Stream START marker for reflection
    if (writer) {
      const startMarker = createObservationStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToObserve: observationTokens,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
        config: this.getObservationMarkerConfig(),
      });
      await writer.custom(startMarker).catch(() => {});
    }

    // Emit reflection_triggered debug event
    this.emitDebugEvent({
      type: 'reflection_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      inputTokens: observationTokens,
      activeObservationsLength: record.activeObservations?.length ?? 0,
    });

    // Create mutable stream context for retry tracking
    const streamContext = writer
      ? {
          writer,
          cycleId,
          startedAt,
          recordId: record.id,
          threadId,
        }
      : undefined;

    try {
      const reflectResult = await this.callReflector(
        record.activeObservations,
        undefined,
        streamContext,
        reflectThreshold,
        abortSignal,
        undefined,
        undefined,
        requestContext,
      );
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Stream END marker for reflection (use streamContext values which may have been updated during retry)
      if (writer && streamContext) {
        const endMarker = createObservationEndMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensObserved: observationTokens,
          observationTokens: reflectionTokenCount,
          observations: reflectResult.observations,
          recordId: record.id,
          threadId,
        });
        await writer.custom(endMarker).catch(() => {});
      }

      // Emit reflection_complete debug event with usage
      this.emitDebugEvent({
        type: 'reflection_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        inputTokens: observationTokens,
        outputTokens: reflectionTokenCount,
        observations: reflectResult.observations,
        usage: reflectResult.usage,
      });
    } catch (error) {
      // Stream FAILED marker for reflection (use streamContext values which may have been updated during retry)
      if (writer && streamContext) {
        const failedMarker = createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: observationTokens,
          error: error instanceof Error ? error.message : String(error),
          recordId: record.id,
          threadId,
        });
        await writer.custom(failedMarker).catch(() => {});
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - reflection failure should not crash the agent
      omError('[OM] Reflection failed', error);
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
      reflectionHooks?.onReflectionEnd?.();
      unregisterOp(record.id, 'reflecting');
    }
  }

  /**
   * Check if we've crossed a new bufferTokens interval boundary for async observation.
   * @internal Used by getObservationStatus() and triggerAsyncBuffering().
   */
  private shouldTriggerAsyncObservation(
    currentTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
    messageTokensThreshold?: number,
  ): boolean {
    if (!this.isAsyncObservationEnabled()) return false;

    if (record.isBufferingObservation) {
      if (isOpActiveInProcess(record.id, 'bufferingObservation')) return false;
      omDebug(`[OM:shouldTriggerAsyncObs] isBufferingObservation=true but stale, clearing`);
      this.storage.setBufferingObservationFlag(record.id, false).catch(() => {});
    }

    const bufferKey = this.getObservationBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;

    const bufferTokens = this.observationConfig.bufferTokens!;
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const memBoundary = ObservationalMemory.lastBufferedBoundary.get(bufferKey) ?? 0;
    const lastBoundary = Math.max(dbBoundary, memBoundary);

    const rampPoint = messageTokensThreshold ? messageTokensThreshold - bufferTokens * 1.1 : Infinity;
    const effectiveBufferTokens = currentTokens >= rampPoint ? bufferTokens / 2 : bufferTokens;

    const currentInterval = Math.floor(currentTokens / effectiveBufferTokens);
    const lastInterval = Math.floor(lastBoundary / effectiveBufferTokens);

    const shouldTrigger = currentInterval > lastInterval;

    omDebug(
      `[OM:shouldTriggerAsyncObs] tokens=${currentTokens}, bufferTokens=${bufferTokens}, effectiveBufferTokens=${effectiveBufferTokens}, rampPoint=${rampPoint}, currentInterval=${currentInterval}, lastInterval=${lastInterval}, lastBoundary=${lastBoundary} (db=${dbBoundary}, mem=${memBoundary}), shouldTrigger=${shouldTrigger}`,
    );

    return shouldTrigger;
  }

  /**
   * Check if async reflection buffering should be triggered.
   * Returns true if all conditions are met: async reflection enabled,
   * no in-flight buffering op, no existing buffered reflection,
   * and observation tokens have crossed the activation point.
   * @internal Used by tests; logic is also inlined in maybeAsyncReflect/maybeReflect.
   */
  private shouldTriggerAsyncReflection(
    observationTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
  ): boolean {
    if (!this.isAsyncReflectionEnabled()) return false;
    if (record.isBufferingReflection) {
      if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
      omDebug(`[OM:shouldTriggerAsyncRefl] isBufferingReflection=true but stale, clearing`);
      this.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
    }
    const bufferKey = this.getReflectionBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;
    if (ObservationalMemory.lastBufferedBoundary.has(bufferKey)) return false;
    if (record.bufferedReflection) return false;
    const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
    const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;
    return observationTokens >= activationPoint;
  }

  /**
   * Check if async reflection should be triggered or activated.
   * Only handles the async path — will never do synchronous (blocking) reflection.
   * @internal Used by observeWithActivation() and tryStep0Activation().
   */
  private async maybeAsyncReflect(opts: {
    record: ObservationalMemoryRecord;
    observationTokens: number;
    writer?: ProcessorStreamWriter;
    messageList?: MessageList;
    requestContext?: RequestContext;
  }): Promise<void> {
    if (!this.isAsyncReflectionEnabled()) return;

    const { record, observationTokens, writer, messageList, requestContext } = opts;
    const lockKey = this.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);

    // Below threshold — check if we should start background buffering
    if (observationTokens < reflectThreshold) {
      const shouldTrigger = (() => {
        if (record.isBufferingReflection) {
          if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
          omDebug(`[OM:maybeAsyncReflect] isBufferingReflection=true but stale, clearing`);
          this.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
        }
        const bufferKey = this.getReflectionBufferKey(lockKey);
        if (this.isAsyncBufferingInProgress(bufferKey)) return false;
        if (ObservationalMemory.lastBufferedBoundary.has(bufferKey)) return false;
        if (record.bufferedReflection) return false;
        const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;
        return observationTokens >= activationPoint;
      })();

      if (shouldTrigger) {
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
      }
      return;
    }

    // At/above threshold — try to activate buffered reflection
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) return;
      omDebug(`[OM:maybeAsyncReflect] isReflecting=true but stale, clearing`);
      await this.storage.setReflectingFlag(record.id, false);
    }

    const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer, messageList);
    if (activationSuccess) return;

    // No buffered content — start background reflection
    this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL API — semantic operations for programmatic use
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get a complete observation status snapshot for a thread/resource.
   *
   * Computes pending tokens, thresholds, and buffering state in one call.
   * Use this to decide whether to trigger observation, buffering, or reflection
   * without directly accessing token counters or config.
   *
   * @example
   * ```ts
   * const status = await om.getObservationStatus({
   *   threadId: 'thread-1',
   *   messages: messageList.get.all.db(),
   * });
   * if (status.shouldObserve) {
   *   await om.observeWithActivation({ ... });
   * }
   * ```
   */
  async getObservationStatus(opts: {
    threadId: string;
    resourceId?: string;
    messages: MastraDBMessage[];
    otherThreadContext?: string;
    currentObservationTokens?: number;
  }): Promise<{
    record: ObservationalMemoryRecord;
    pendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    bufferedChunkTokens: number;
    unbufferedPendingTokens: number;
    shouldObserve: boolean;
    shouldBuffer: boolean;
    asyncObservationEnabled: boolean;
    asyncReflectionEnabled: boolean;
    scope: 'resource' | 'thread';
  }> {
    const { threadId, resourceId, messages, otherThreadContext } = opts;
    const record = await this.getOrCreateRecord(threadId, resourceId);
    const currentObservationTokens = opts.currentObservationTokens ?? record.observationTokenCount ?? 0;

    // Get unobserved messages and count tokens
    const unobservedMessages = this.getUnobservedMessages(messages, record);
    const contextWindowTokens = await this.tokenCounter.countMessagesAsync(unobservedMessages);
    const otherThreadTokens = otherThreadContext ? this.tokenCounter.countString(otherThreadContext) : 0;
    const pendingTokens = Math.max(0, contextWindowTokens + otherThreadTokens);

    // Calculate threshold
    const threshold = calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);

    // Calculate effective reflection threshold for UI display
    const baseReflectionThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
    const isSharedBudget = typeof this.observationConfig.messageTokens !== 'number';
    const totalBudget = isSharedBudget ? (this.observationConfig.messageTokens as { min: number; max: number }).max : 0;
    const effectiveObservationTokensThreshold = isSharedBudget
      ? Math.max(totalBudget - threshold, 1000)
      : baseReflectionThreshold;

    // Calculate buffered chunk state
    const bufferedChunks = this.getBufferedChunks(record);
    const bufferedChunkTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
    const unbufferedPendingTokens = Math.max(0, pendingTokens - bufferedChunkTokens);

    // Determine if async buffering should trigger
    const asyncObservationEnabled = this.isAsyncObservationEnabled();
    let shouldBuffer = false;
    if (asyncObservationEnabled) {
      const lockKey = this.getLockKey(threadId, resourceId);
      shouldBuffer = this.shouldTriggerAsyncObservation(pendingTokens, lockKey, record, threshold);
    }

    return {
      record,
      pendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
      bufferedChunkTokens,
      unbufferedPendingTokens,
      shouldObserve: pendingTokens >= threshold,
      shouldBuffer,
      asyncObservationEnabled,
      asyncReflectionEnabled: this.isAsyncReflectionEnabled(),
      scope: this.scope,
    };
  }

  /**
   * Run the full observation cycle — including async buffered activation, sync fallback,
   * thread metadata updates, and async reflection triggering.
   *
   * This is the "batteries included" observation method. Unlike `observe()` which is
   * a simpler manual API, this handles the complete async-buffering-aware lifecycle:
   * 1. Acquires a lock
   * 2. Re-checks threshold inside the lock
   * 3. Tries to activate buffered observations (instant activation)
   * 4. Falls back to synchronous observation if needed
   * 5. Propagates continuation hints to thread metadata
   * 6. Triggers async reflection if applicable
   *
   * @example
   * ```ts
   * const result = await om.observeWithActivation({
   *   threadId: 'thread-1',
   *   messages: messageList.get.all.db(),
   *   messageList,
   *   threshold: status.threshold,
   * });
   * if (result.succeeded) {
   *   await om.cleanupObservedContext({ ... });
   * }
   * ```
   */
  async observeWithActivation(opts: {
    threadId: string;
    resourceId?: string;
    messages: MastraDBMessage[];
    messageList?: MessageList;
    threshold: number;
    otherThreadContext?: string;
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    requestContext?: RequestContext;
  }): Promise<{
    succeeded: boolean;
    record: ObservationalMemoryRecord;
    activatedMessageIds?: string[];
  }> {
    const { threadId, resourceId, messageList, threshold, writer, abortSignal, requestContext } = opts;
    const lockKey = this.getLockKey(threadId, resourceId);

    let observationSucceeded = false;
    let updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
    let activatedMessageIds: string[] | undefined;

    await this.withLock(lockKey, async () => {
      let freshRecord = await this.getOrCreateRecord(threadId, resourceId);
      const freshMessages = messageList ? messageList.get.all.db() : opts.messages;
      let freshUnobservedMessages = this.getUnobservedMessages(freshMessages, freshRecord);

      // Re-check threshold inside the lock
      const freshContextTokens = await this.tokenCounter.countMessagesAsync(freshUnobservedMessages);
      let freshOtherThreadTokens = 0;
      if (this.scope === 'resource' && resourceId && opts.otherThreadContext) {
        freshOtherThreadTokens = this.tokenCounter.countString(opts.otherThreadContext);
      } else if (this.scope === 'resource' && resourceId) {
        const freshOtherContext = await this.getOtherThreadsContext(resourceId, threadId);
        freshOtherThreadTokens = freshOtherContext ? this.tokenCounter.countString(freshOtherContext) : 0;
      }
      const freshTotal = freshContextTokens + freshOtherThreadTokens;
      omDebug(
        `[OM:observeWithActivation] inside lock: freshTotal=${freshTotal}, threshold=${threshold}, freshUnobserved=${freshUnobservedMessages.length}`,
      );
      if (freshTotal < threshold) {
        omDebug(`[OM:observeWithActivation] freshTotal < threshold, bailing out`);
        return;
      }

      const preObservationTime = freshRecord.lastObservedAt?.getTime() ?? 0;

      // Try to activate buffered observations first (instant activation)
      let activationResult: {
        success: boolean;
        updatedRecord?: ObservationalMemoryRecord;
        messageTokensActivated?: number;
        activatedMessageIds?: string[];
        suggestedContinuation?: string;
        currentTask?: string;
      } = { success: false };

      if (this.isAsyncObservationEnabled()) {
        // Wait for any in-flight async buffering to complete first
        const bufferKey = this.getObservationBufferKey(lockKey);
        const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
        if (asyncOp) {
          try {
            await Promise.race([
              asyncOp,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
            ]);
          } catch {
            // Timeout or error - proceed with what we have
          }
        }

        const recordAfterWait = await this.getOrCreateRecord(threadId, resourceId);
        activationResult = await this.tryActivateBufferedObservations(
          recordAfterWait,
          lockKey,
          freshTotal,
          writer,
          messageList,
        );
        omDebug(`[OM:observeWithActivation] activationResult: success=${activationResult.success}`);

        if (activationResult.success) {
          observationSucceeded = true;
          updatedRecord = activationResult.updatedRecord ?? recordAfterWait;
          activatedMessageIds = activationResult.activatedMessageIds;

          // Propagate continuation hints to thread metadata
          const thread = await this.storage.getThreadById({ threadId });
          if (thread) {
            const newMetadata = setThreadOMMetadata(thread.metadata, {
              suggestedResponse: activationResult.suggestedContinuation,
              currentTask: activationResult.currentTask,
            });
            await this.storage.updateThread({
              id: threadId,
              title: thread.title ?? '',
              metadata: newMetadata,
            });
          }

          // Trigger async reflection if applicable
          await this.maybeAsyncReflect({
            record: updatedRecord,
            observationTokens: updatedRecord.observationTokenCount ?? 0,
            writer,
            messageList,
            requestContext,
          });
          return;
        }

        // When async observation is enabled, don't fall through to synchronous observation
        // unless blockAfter is set and we've exceeded it.
        if (this.observationConfig.blockAfter && freshTotal >= this.observationConfig.blockAfter) {
          omDebug(
            `[OM:observeWithActivation] blockAfter exceeded (${freshTotal} >= ${this.observationConfig.blockAfter}), falling through to sync`,
          );
          freshRecord = await this.getOrCreateRecord(threadId, resourceId);
          const refreshedAll = messageList ? messageList.get.all.db() : opts.messages;
          freshUnobservedMessages = this.getUnobservedMessages(refreshedAll, freshRecord);
        } else {
          omDebug(`[OM:observeWithActivation] activation failed, below blockAfter — letting async catch up`);
          return;
        }
      }

      // Sync observation path
      if (freshUnobservedMessages.length > 0) {
        if (this.scope === 'resource' && resourceId) {
          await this.doResourceScopedObservation({
            record: freshRecord,
            currentThreadId: threadId,
            resourceId,
            currentThreadMessages: freshUnobservedMessages,
            writer,
            abortSignal,
            requestContext,
          });
        } else {
          await this.doSynchronousObservation({
            record: freshRecord,
            threadId,
            unobservedMessages: freshUnobservedMessages,
            writer,
            abortSignal,
            requestContext,
          });
        }
        updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
        const updatedTime = updatedRecord.lastObservedAt?.getTime() ?? 0;
        observationSucceeded = updatedTime > preObservationTime;
      }
    });

    return { succeeded: observationSucceeded, record: updatedRecord, activatedMessageIds };
  }

  /**
   * Trigger async buffered observation if the token count has crossed a new interval.
   *
   * Encapsulates the shouldTrigger check + startAsyncBufferedObservation call.
   * Returns whether buffering was actually triggered.
   */
  async triggerAsyncBuffering(opts: {
    threadId: string;
    resourceId?: string;
    record: ObservationalMemoryRecord;
    pendingTokens: number;
    unbufferedPendingTokens: number;
    unobservedMessages: MastraDBMessage[];
    threshold: number;
    writer?: ProcessorStreamWriter;
    requestContext?: RequestContext;
  }): Promise<boolean> {
    if (!this.isAsyncObservationEnabled()) return false;

    const lockKey = this.getLockKey(opts.threadId, opts.resourceId);
    const shouldTrigger = this.shouldTriggerAsyncObservation(opts.pendingTokens, lockKey, opts.record, opts.threshold);

    if (shouldTrigger) {
      void this.startAsyncBufferedObservation(
        opts.record,
        opts.threadId,
        opts.unobservedMessages,
        lockKey,
        opts.writer,
        opts.unbufferedPendingTokens,
        opts.requestContext,
      );
    }

    return shouldTrigger;
  }

  /**
   * Clean up the message context after a successful observation.
   *
   * Handles both activation-based cleanup (using observedMessageIds) and
   * marker-based cleanup (using observation boundary markers). Respects
   * retention floors to prevent removing too many messages.
   */
  async cleanupObservedContext(opts: {
    messageList: MessageList;
    sealedIds: Set<string>;
    threadId: string;
    resourceId?: string;
    state?: Record<string, unknown>;
    observedMessageIds?: string[];
    retentionFloor?: number;
  }): Promise<void> {
    const { messageList, sealedIds, threadId, resourceId, state, observedMessageIds, retentionFloor } = opts;
    const allMsgs = messageList.get.all.db();
    let markerIdx = -1;
    let markerMsg: MastraDBMessage | null = null;

    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (!msg) continue;
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        markerIdx = i;
        markerMsg = msg;
        break;
      }
    }

    omDebug(
      `[OM:cleanupBranch] allMsgs=${allMsgs.length}, markerFound=${markerIdx !== -1}, markerIdx=${markerIdx}, observedMessageIds=${observedMessageIds?.length ?? 'undefined'}`,
    );

    if (observedMessageIds && observedMessageIds.length > 0) {
      // Activation-based cleanup
      const observedSet = new Set(observedMessageIds);
      const idsToRemove = new Set<string>();
      const removalOrder: string[] = [];
      let skipped = 0;
      let backoffTriggered = false;
      const retentionCounter = typeof retentionFloor === 'number' ? new TokenCounter() : null;

      for (const msg of allMsgs) {
        if (!msg?.id || msg.id === 'om-continuation' || !observedSet.has(msg.id)) continue;

        const unobservedParts = this.getUnobservedParts(msg);
        const totalParts = msg.content?.parts?.length ?? 0;

        if (unobservedParts.length > 0 && unobservedParts.length < totalParts) {
          msg.content.parts = unobservedParts;
          continue;
        }

        if (retentionCounter && typeof retentionFloor === 'number') {
          const nextRemainingMessages = allMsgs.filter(
            m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id) && m.id !== msg.id,
          );
          const remainingIfRemoved = retentionCounter.countMessages(nextRemainingMessages);
          if (remainingIfRemoved < retentionFloor) {
            skipped += 1;
            backoffTriggered = true;
            break;
          }
        }

        idsToRemove.add(msg.id);
        removalOrder.push(msg.id);
      }

      if (retentionCounter && typeof retentionFloor === 'number' && idsToRemove.size > 0) {
        let remainingMessages = allMsgs.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
        let remainingTokens = retentionCounter.countMessages(remainingMessages);

        while (remainingTokens < retentionFloor && removalOrder.length > 0) {
          const restoreId = removalOrder.pop()!;
          idsToRemove.delete(restoreId);
          skipped += 1;
          backoffTriggered = true;
          remainingMessages = allMsgs.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
          remainingTokens = retentionCounter.countMessages(remainingMessages);
        }
      }

      omDebug(
        `[OM:cleanupActivation] matched=${idsToRemove.size}, skipped=${skipped}, backoffTriggered=${backoffTriggered}`,
      );

      const idsToRemoveList = [...idsToRemove];
      if (idsToRemoveList.length > 0) {
        messageList.removeByIds(idsToRemoveList);
      }
    } else if (markerMsg && markerIdx !== -1) {
      // Marker-based cleanup
      const idsToRemove: string[] = [];
      const messagesToSave: MastraDBMessage[] = [];

      for (let i = 0; i < markerIdx; i++) {
        const msg = allMsgs[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          idsToRemove.push(msg.id);
          messagesToSave.push(msg);
        }
      }

      messagesToSave.push(markerMsg);

      const unobservedParts = this.getUnobservedParts(markerMsg);
      if (unobservedParts.length === 0) {
        if (markerMsg.id) idsToRemove.push(markerMsg.id);
      } else if (unobservedParts.length < (markerMsg.content?.parts?.length ?? 0)) {
        markerMsg.content.parts = unobservedParts;
      }

      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
      }

      if (messagesToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state ?? {});
      }

      omDebug(`[OM:cleanupMarker] removed ${idsToRemove.length} messages, saved ${messagesToSave.length}`);
    } else {
      // No marker found — save current input/response messages first, then clear.
      // Keeping them in MessageList until save finishes avoids brief under-inclusion windows
      // where fresh-next-turn context can disappear during async persistence.
      const newInput = messageList.get.input.db();
      const newOutput = messageList.get.response.db();
      const msgsToSave = [...newInput, ...newOutput];
      if (msgsToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(msgsToSave, sealedIds, threadId, resourceId, state ?? {});
      }
    }
  }

  /**
   * Reset buffering state after a successful observation activation.
   *
   * Clears the lastBufferedBoundary, buffering flag, and optionally cleans up
   * static maps for activated message IDs.
   */
  async resetBufferingState(opts: {
    threadId: string;
    resourceId?: string;
    recordId: string;
    activatedMessageIds?: string[];
  }): Promise<void> {
    const { threadId, resourceId, recordId, activatedMessageIds } = opts;
    const lockKey = this.getLockKey(threadId, resourceId);
    const bufKey = this.getObservationBufferKey(lockKey);

    ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
    await this.storage.setBufferingObservationFlag(recordId, false, 0).catch(() => {});

    if (activatedMessageIds && activatedMessageIds.length > 0) {
      this.cleanupStaticMaps(threadId, resourceId, activatedMessageIds);
    }
  }

  /**
   * Build the observation system message string for injection into an LLM prompt.
   *
   * Loads thread metadata (currentTask, suggestedResponse), formats observations
   * with context prompts and instructions, and returns the fully-formed string.
   * Returns undefined if no observations exist.
   *
   * This is the public entry point for context formatting — used by both
   * Memory.getContext() (standalone) and the processor (via injectObservationsIntoMessages).
   *
   * @example
   * ```ts
   * const systemMsg = await om.buildContextSystemMessage({ threadId: 'thread-1' });
   * if (systemMsg) {
   *   const result = await generateText({ system: systemMsg, messages });
   * }
   * ```
   */
  async buildContextSystemMessage(opts: {
    threadId: string;
    resourceId?: string;
    record?: ObservationalMemoryRecord;
    unobservedContextBlocks?: string;
    currentDate?: Date;
  }): Promise<string | undefined> {
    const { threadId, resourceId, unobservedContextBlocks } = opts;
    const record = opts.record ?? (await this.getOrCreateRecord(threadId, resourceId));

    if (!record.activeObservations) return undefined;

    // Read thread metadata for continuation hints
    const thread = await this.storage.getThreadById({ threadId });
    const omMetadata = getThreadOMMetadata(thread?.metadata);
    const currentTask = omMetadata?.currentTask;
    const suggestedResponse = omMetadata?.suggestedResponse;
    const currentDate = opts.currentDate ?? new Date();

    return this.formatObservationsForContext(
      record.activeObservations,
      currentTask,
      suggestedResponse,
      unobservedContextBlocks,
      currentDate,
    );
  }

  /**
   * Inject observations into the message list as a system message.
   *
   * Reads thread metadata for continuation hints, formats observations,
   * clears any existing OM system messages, and adds a fresh one along
   * with a continuation reminder.
   */
  private async injectObservationsIntoMessages(opts: {
    messageList: MessageList;
    record: ObservationalMemoryRecord;
    threadId: string;
    resourceId?: string;
    unobservedContextBlocks?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { messageList, record, threadId, unobservedContextBlocks, requestContext } = opts;

    if (!record.activeObservations) return;

    const rawCurrentDate = requestContext?.get('currentDate');
    const currentDate =
      rawCurrentDate instanceof Date
        ? rawCurrentDate
        : typeof rawCurrentDate === 'string'
          ? new Date(rawCurrentDate)
          : new Date();

    const observationSystemMessage = await this.buildContextSystemMessage({
      threadId,
      resourceId: opts.resourceId,
      record,
      unobservedContextBlocks,
      currentDate,
    });

    if (!observationSystemMessage) return;

    messageList.clearSystemMessages('observational-memory');
    messageList.addSystem(observationSystemMessage, 'observational-memory');

    const continuationMessage: MastraDBMessage = {
      id: `om-continuation`,
      role: 'user',
      createdAt: new Date(0),
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>`,
          },
        ],
      },
      threadId,
      resourceId: opts.resourceId,
    };
    messageList.add(continuationMessage, 'memory');
  }

  /**
   * Filter out already-observed messages from the in-memory context.
   *
   * Uses marker-boundary pruning (safest at step 0) or record-based fallback
   * (for step > 0 where the list may have mid-loop mutations).
   */
  async filterObservedMessages(opts: {
    messageList: MessageList;
    record?: ObservationalMemoryRecord;
    useMarkerBoundaryPruning?: boolean;
  }): Promise<void> {
    const { messageList, record } = opts;
    const allMessages = messageList.get.all.db();
    const useMarkerBoundaryPruning = opts.useMarkerBoundaryPruning ?? true;
    const fallbackCursor = record?.threadId
      ? getThreadOMMetadata((await this.storage.getThreadById({ threadId: record.threadId }))?.metadata)
          ?.lastObservedMessageCursor
      : undefined;

    let markerMessageIndex = -1;
    let markerMessage: MastraDBMessage | null = null;

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (!msg) continue;
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        markerMessageIndex = i;
        markerMessage = msg;
        break;
      }
    }

    if (useMarkerBoundaryPruning && markerMessage && markerMessageIndex !== -1) {
      const messagesToRemove: string[] = [];
      for (let i = 0; i < markerMessageIndex; i++) {
        const msg = allMessages[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          messagesToRemove.push(msg.id);
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }

      const unobservedParts = this.getUnobservedParts(markerMessage);
      if (unobservedParts.length === 0) {
        if (markerMessage.id) messageList.removeByIds([markerMessage.id]);
      } else if (unobservedParts.length < (markerMessage.content?.parts?.length ?? 0)) {
        markerMessage.content.parts = unobservedParts;
      }
    } else if (record) {
      const observedIds = new Set<string>(Array.isArray(record.observedMessageIds) ? record.observedMessageIds : []);

      const derivedCursor =
        fallbackCursor ??
        this.getLastObservedMessageCursor(
          allMessages.filter(msg => !!msg?.id && observedIds.has(msg.id) && !!msg.createdAt),
        );
      const lastObservedAt = record.lastObservedAt;
      const messagesToRemove: string[] = [];

      for (const msg of allMessages) {
        if (!msg?.id || msg.id === 'om-continuation') continue;

        if (observedIds.has(msg.id)) {
          messagesToRemove.push(msg.id);
          continue;
        }

        if (derivedCursor && this.isMessageAtOrBeforeCursor(msg, derivedCursor)) {
          messagesToRemove.push(msg.id);
          continue;
        }

        if (lastObservedAt && msg.createdAt) {
          const msgDate = new Date(msg.createdAt);
          if (msgDate <= lastObservedAt) {
            messagesToRemove.push(msg.id);
          }
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }
    }
  }

  /**
   * Get unobserved messages from other threads for resource-scoped observation.
   *
   * Lists all threads for the resource, filters to unobserved messages,
   * and formats them as context blocks.
   */
  async getOtherThreadsContext(resourceId: string, currentThreadId: string): Promise<string | undefined> {
    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId } });
    const messagesByThread = new Map<string, MastraDBMessage[]>();

    for (const thread of allThreads) {
      if (thread.id === currentThreadId) continue;

      const omMetadata = getThreadOMMetadata(thread.metadata);
      const threadLastObservedAt = omMetadata?.lastObservedAt;
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      const filtered = result.messages.filter(m => !this.observedMessageIds.has(m.id));

      if (filtered.length > 0) {
        messagesByThread.set(thread.id, filtered);
      }
    }

    if (messagesByThread.size === 0) return undefined;
    const blocks = await this.formatUnobservedContextBlocks(messagesByThread, currentThreadId);
    return blocks || undefined;
  }

  /**
   * Count tokens in a set of messages.
   * Synchronous (uses cached token estimates).
   */
  countMessageTokens(messages: MastraDBMessage[]): number {
    return this.tokenCounter.countMessages(messages);
  }

  /**
   * Count tokens in a set of messages (async, more accurate).
   */
  async countMessageTokensAsync(messages: MastraDBMessage[]): Promise<number> {
    return this.tokenCounter.countMessagesAsync(messages);
  }

  /**
   * Count tokens in a string.
   */
  countStringTokens(text: string): number {
    return this.tokenCounter.countString(text);
  }

  /**
   * Save pending token count to storage.
   */
  async savePendingTokens(recordId: string, tokens: number): Promise<void> {
    await this.storage.setPendingMessageTokens(recordId, tokens).catch(() => {});
  }

  /**
   * Get the set of sealed message IDs for a buffer key.
   */
  getSealedIds(threadId: string, resourceId?: string): Set<string> | undefined {
    const lockKey = this.getLockKey(threadId, resourceId);
    const bufKey = this.getObservationBufferKey(lockKey);
    return ObservationalMemory.sealedMessageIds.get(bufKey);
  }

  /**
   * Load historical unobserved messages into the message list.
   *
   * Typically called at step 0 to restore conversation context from storage.
   * In resource scope, loads only the current thread's messages.
   * In thread scope, loads all unobserved messages for the thread.
   */
  private async loadHistory(opts: {
    messageList: MessageList;
    threadId: string;
    resourceId?: string;
    lastObservedAt?: Date;
  }): Promise<void> {
    const { messageList, threadId, resourceId, lastObservedAt } = opts;

    if (this.scope === 'resource' && resourceId) {
      const currentThreadMessages = await this.loadUnobservedMessages(threadId, undefined, lastObservedAt);
      for (const msg of currentThreadMessages) {
        if (msg.role !== 'system') {
          if (!this.hasUnobservedParts(msg) && this.findLastCompletedObservationBoundary(msg) !== -1) continue;
          messageList.add(msg, 'memory');
        }
      }
    } else {
      const historicalMessages = await this.loadUnobservedMessages(threadId, resourceId, lastObservedAt);
      for (const msg of historicalMessages) {
        if (msg.role !== 'system') {
          if (!this.hasUnobservedParts(msg) && this.findLastCompletedObservationBoundary(msg) !== -1) continue;
          messageList.add(msg, 'memory');
        }
      }
    }
  }

  /**
   * Save messages incrementally during an agent step.
   *
   * Clears input/response messages from the message list, persists them to storage
   * with sealed ID tracking, then re-adds them to the list so the agent can still
   * see them.
   */
  async saveIncrementalMessages(opts: {
    messageList: MessageList;
    sealedIds: Set<string>;
    threadId: string;
    resourceId?: string;
    state?: Record<string, unknown>;
  }): Promise<void> {
    const { messageList, sealedIds, threadId, resourceId, state } = opts;
    const newInput = messageList.clear.input.db();
    const newOutput = messageList.clear.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    omDebug(
      `[OM:saveIncremental] cleared input=${newInput.length}, response=${newOutput.length}, toSave=${messagesToSave.length}`,
    );

    if (messagesToSave.length > 0) {
      await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state ?? {});
      for (const msg of messagesToSave) {
        messageList.add(msg, 'memory');
      }
    }
  }

  /**
   * Save final output messages (e.g., the assistant's response after the last step).
   */
  async saveFinalMessages(opts: {
    messageList: MessageList;
    sealedIds: Set<string>;
    threadId: string;
    resourceId?: string;
    state?: Record<string, unknown>;
  }): Promise<void> {
    const { messageList, sealedIds, threadId, resourceId, state } = opts;
    const newInput = messageList.get.input.db();
    const newOutput = messageList.get.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    omDebug(
      `[OM:saveFinal] inputMsgs=${newInput.length}, responseMsgs=${newOutput.length}, totalToSave=${messagesToSave.length}`,
    );

    if (messagesToSave.length > 0) {
      await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state ?? {});
    }
  }

  /**
   * Emit debug event and stream progress for UI feedback.
   */
  async emitProgress(opts: {
    record: ObservationalMemoryRecord;
    pendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    currentObservationTokens: number;
    writer?: ProcessorStreamWriter;
    stepNumber: number;
    threadId: string;
    resourceId?: string;
  }): Promise<void> {
    const {
      record,
      pendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
      currentObservationTokens,
      writer,
      stepNumber,
      threadId,
      resourceId,
    } = opts;

    this.emitDebugEvent({
      type: 'step_progress',
      timestamp: new Date(),
      threadId,
      resourceId: resourceId ?? '',
      stepNumber,
      finishReason: 'unknown',
      pendingTokens,
      threshold,
      thresholdPercent: Math.round((pendingTokens / threshold) * 100),
      willSave: pendingTokens >= threshold,
      willObserve: pendingTokens >= threshold,
    });

    if (writer) {
      const bufferedChunks = this.getBufferedChunks(record);
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);
      const rawBufferedMessageTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const bufferedMessageTokens = Math.min(rawBufferedMessageTokens, pendingTokens);

      const projectedMessageRemoval = calculateProjectedMessageRemoval(
        bufferedChunks,
        this.observationConfig.bufferActivation ?? 1,
        getMaxThreshold(this.observationConfig.messageTokens),
        pendingTokens,
      );

      let obsBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingObservation) obsBufferStatus = 'running';
      else if (bufferedChunks.length > 0) obsBufferStatus = 'complete';

      let refBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingReflection) refBufferStatus = 'running';
      else if (record.bufferedReflection && record.bufferedReflection.length > 0) refBufferStatus = 'complete';

      const statusPart: DataOmStatusPart = {
        type: 'data-om-status',
        data: {
          windows: {
            active: {
              messages: { tokens: pendingTokens, threshold },
              observations: { tokens: currentObservationTokens, threshold: effectiveObservationTokensThreshold },
            },
            buffered: {
              observations: {
                chunks: bufferedChunks.length,
                messageTokens: bufferedMessageTokens,
                projectedMessageRemoval,
                observationTokens: bufferedObservationTokens,
                status: obsBufferStatus,
              },
              reflection: {
                inputObservationTokens: record.bufferedReflectionInputTokens ?? 0,
                observationTokens: record.bufferedReflectionTokens ?? 0,
                status: refBufferStatus,
              },
            },
          },
          recordId: record.id,
          threadId,
          stepNumber,
          generationCount: record.generationCount,
        },
      };
      omDebug(
        `[OM:status] step=${stepNumber} msgs=${pendingTokens}/${threshold} obs=${currentObservationTokens}/${effectiveObservationTokensThreshold} gen=${record.generationCount}`,
      );
      await writer.custom(statusPart).catch(() => {});
    }
  }

  /**
   * Check if we've crossed a step-0 buffered observation activation threshold
   * and attempt activation. Also handles stale boundary resets.
   *
   * Returns the activation result and the refreshed record.
   */
  async tryStep0Activation(opts: {
    messageList: MessageList;
    record: ObservationalMemoryRecord;
    threadId: string;
    resourceId?: string;
    messages: MastraDBMessage[];
    otherThreadContext?: string;
    currentObservationTokens: number;
    writer?: ProcessorStreamWriter;
    requestContext?: RequestContext;
  }): Promise<{
    activated: boolean;
    record: ObservationalMemoryRecord;
    activatedMessageIds?: string[];
    activationDetails?: Record<string, unknown>;
  }> {
    const {
      messageList,
      record,
      threadId,
      resourceId,
      messages,
      otherThreadContext,
      currentObservationTokens,
      writer,
      requestContext,
    } = opts;

    if (!this.isAsyncObservationEnabled()) {
      return { activated: false, record };
    }

    const lockKey = this.getLockKey(threadId, resourceId);
    const bufferedChunks = this.getBufferedChunks(record);
    omDebug(
      `[OM:step0-activation] asyncObsEnabled=true, bufferedChunks=${bufferedChunks.length}, isBufferingObs=${record.isBufferingObservation}`,
    );

    // Reset stale lastBufferedBoundary at the start of a new turn
    const bufKey = this.getObservationBufferKey(lockKey);
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const currentContextTokens = this.tokenCounter.countMessages(messages);
    if (dbBoundary > 0 && currentContextTokens < dbBoundary * 0.5) {
      omDebug(
        `[OM:step0-activation] resetting stale lastBufferedBoundary: dbBoundary=${dbBoundary}, currentContextTokens=${currentContextTokens}`,
      );
      ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
      await this.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});
    }

    if (bufferedChunks.length === 0) {
      return { activated: false, record };
    }

    // Calculate thresholds to decide if activation should happen
    const unobservedMessages = this.getUnobservedMessages(messages, record);
    const contextTokens = await this.tokenCounter.countMessagesAsync(unobservedMessages);
    const otherThreadTokens = otherThreadContext ? this.tokenCounter.countString(otherThreadContext) : 0;
    const pendingTokens = contextTokens + otherThreadTokens;
    const threshold = calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);

    omDebug(
      `[OM:step0-activation] pendingTokens=${pendingTokens}, threshold=${threshold}, blockAfter=${this.observationConfig.blockAfter}`,
    );

    if (pendingTokens < threshold) {
      return { activated: false, record };
    }

    const activationResult = await this.tryActivateBufferedObservations(
      record,
      lockKey,
      pendingTokens,
      writer,
      messageList,
    );

    const activationDetails: Record<string, unknown> = {
      attempted: true,
      success: activationResult.success,
      messageTokensActivated: activationResult.messageTokensActivated,
      activatedMessageIds: activationResult.activatedMessageIds,
      hadUpdatedRecord: !!activationResult.updatedRecord,
    };

    if (!activationResult.success) {
      return { activated: false, record, activationDetails };
    }

    const updatedRecord = activationResult.updatedRecord ?? record;

    // Remove activated messages from context
    if (activationResult.activatedMessageIds && activationResult.activatedMessageIds.length > 0) {
      messageList.removeByIds(activationResult.activatedMessageIds);
      this.cleanupStaticMaps(threadId, resourceId, activationResult.activatedMessageIds);
    }

    // Reset buffering state
    await this.resetBufferingState({ threadId, resourceId, recordId: updatedRecord.id });

    // Update thread metadata with continuation hints
    const thread = await this.storage.getThreadById({ threadId });
    if (thread) {
      const newMeta = setThreadOMMetadata(thread.metadata, {
        suggestedResponse: activationResult.suggestedContinuation,
        currentTask: activationResult.currentTask,
        lastObservedMessageCursor: this.getLastObservedMessageCursor(
          unobservedMessages.filter(msg => !!msg?.id && !!msg.createdAt),
        ),
      });
      await this.storage.updateThread({ id: threadId, title: thread.title ?? '', metadata: newMeta });
    }

    // Maybe trigger reflection
    await this.maybeReflect({
      record: updatedRecord,
      observationTokens: updatedRecord.observationTokenCount ?? 0,
      writer,
      messageList,
      requestContext,
    });

    // Check for standalone async reflection if no sync reflection happened
    if (this.isAsyncReflectionEnabled()) {
      const freshRecordAfterReflect = await this.getOrCreateRecord(threadId, resourceId);
      const obsTokens = freshRecordAfterReflect.observationTokenCount ?? 0;
      const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
      if (obsTokens < reflectThreshold) {
        await this.maybeAsyncReflect({
          record: freshRecordAfterReflect,
          observationTokens: obsTokens,
          writer,
          messageList,
          requestContext,
        });
      }
    }

    // Re-fetch record after all operations
    const finalRecord = await this.getOrCreateRecord(threadId, resourceId);

    return {
      activated: true,
      record: finalRecord,
      activatedMessageIds: activationResult.activatedMessageIds,
      activationDetails,
    };
  }

  /**
   * Check if step-0 reflection should be triggered (standalone, outside of observation).
   * Handles both sync and async reflection paths.
   */
  async maybeStep0Reflect(opts: {
    record: ObservationalMemoryRecord;
    threadId: string;
    resourceId?: string;
    writer?: ProcessorStreamWriter;
    messageList?: MessageList;
    requestContext?: RequestContext;
  }): Promise<ObservationalMemoryRecord> {
    const { record, threadId, resourceId, writer, messageList, requestContext } = opts;
    const obsTokens = record.observationTokenCount ?? 0;
    const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);

    // Sync reflection
    if (obsTokens > reflectThreshold) {
      await this.maybeReflect({
        record,
        observationTokens: obsTokens,
        writer,
        messageList,
        requestContext,
      });
      return this.getOrCreateRecord(threadId, resourceId);
    }

    // Async reflection
    if (this.isAsyncReflectionEnabled()) {
      await this.maybeAsyncReflect({
        record,
        observationTokens: obsTokens,
        writer,
        messageList,
        requestContext,
      });
      return this.getOrCreateRecord(threadId, resourceId);
    }

    return record;
  }

  /**
   * Manually trigger observation.
   *
   * When `messages` is provided, those are used directly (filtered for unobserved)
   * instead of reading from storage. This allows external systems (e.g., opencode)
   * to pass conversation messages without duplicating them into Mastra's DB.
   *
   * Returns a result indicating whether observation and/or reflection occurred,
   * along with the updated record.
   */
  async observe(opts: {
    threadId: string;
    resourceId?: string;
    messages?: MastraDBMessage[];
    hooks?: ObserveHooks;
    requestContext?: RequestContext;
  }): Promise<{
    observed: boolean;
    reflected: boolean;
    record: ObservationalMemoryRecord;
  }> {
    const { threadId, resourceId, messages, hooks, requestContext } = opts;
    const lockKey = this.getLockKey(threadId, resourceId);
    const reflectionHooks = hooks
      ? { onReflectionStart: hooks.onReflectionStart, onReflectionEnd: hooks.onReflectionEnd }
      : undefined;

    let observed = false;
    let generationBefore = -1;

    await this.withLock(lockKey, async () => {
      // Re-fetch record inside lock to get latest state
      const freshRecord = await this.getOrCreateRecord(threadId, resourceId);
      generationBefore = freshRecord.generationCount;

      if (this.scope === 'resource' && resourceId) {
        // Resource scope: check threshold before observing
        const currentMessages = messages ?? [];
        if (
          !this.meetsObservationThreshold({
            record: freshRecord,
            unobservedTokens: await this.tokenCounter.countMessagesAsync(currentMessages),
          })
        ) {
          return;
        }

        hooks?.onObservationStart?.();
        try {
          await this.doResourceScopedObservation({
            record: freshRecord,
            currentThreadId: threadId,
            resourceId,
            currentThreadMessages: currentMessages,
            reflectionHooks,
            requestContext,
          });
          observed = true;
        } finally {
          hooks?.onObservationEnd?.();
        }
      } else {
        // Thread scope: use provided messages or load from storage
        const unobservedMessages = messages
          ? this.getUnobservedMessages(messages, freshRecord)
          : await this.loadUnobservedMessages(
              threadId,
              resourceId,
              freshRecord.lastObservedAt ? new Date(freshRecord.lastObservedAt) : undefined,
            );

        if (unobservedMessages.length === 0) {
          return;
        }

        // Check token threshold before observing
        if (
          !this.meetsObservationThreshold({
            record: freshRecord,
            unobservedTokens: await this.tokenCounter.countMessagesAsync(unobservedMessages),
          })
        ) {
          return;
        }

        hooks?.onObservationStart?.();
        try {
          await this.doSynchronousObservation({
            record: freshRecord,
            threadId,
            unobservedMessages,
            reflectionHooks,
            requestContext,
          });
          observed = true;
        } finally {
          hooks?.onObservationEnd?.();
        }
      }
    });

    // Fetch the latest record after lock release
    const record = await this.getOrCreateRecord(threadId, resourceId);
    const reflected = record.generationCount > generationBefore && generationBefore >= 0;
    return { observed, reflected, record };
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
  async reflect(
    threadId: string,
    resourceId?: string,
    prompt?: string,
    requestContext?: RequestContext,
  ): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);

    if (!record.activeObservations) {
      return;
    }

    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    try {
      const reflectThreshold = getMaxThreshold(this.reflectionConfig.observationTokens);
      const reflectResult = await this.callReflector(
        record.activeObservations,
        prompt,
        undefined,
        reflectThreshold,
        undefined,
        undefined,
        undefined,
        requestContext,
      );
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Note: Thread metadata (currentTask, suggestedResponse) is preserved on each thread
      // and doesn't need to be updated during reflection - it was set during observation
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
      unregisterOp(record.id, 'reflecting');
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
    // Clean up static maps to prevent memory leaks
    this.cleanupStaticMaps(ids.threadId ?? ids.resourceId, ids.resourceId);
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
   * Get current observation configuration
   */
  getObservationConfig(): ResolvedObservationConfig {
    return this.observationConfig;
  }

  /**
   * Get current reflection configuration
   */
  getReflectionConfig(): ResolvedReflectionConfig {
    return this.reflectionConfig;
  }
}
