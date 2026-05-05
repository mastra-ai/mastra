import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { coreFeatures } from '@mastra/core/features';
import type { MastraModelConfig } from '@mastra/core/llm';
import { resolveModelConfig } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import { MessageHistory } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage, ObservationalMemoryRecord, ObservationalMemoryHistoryOptions } from '@mastra/core/storage';
import xxhash from 'xxhash-wasm';

import { BufferingCoordinator } from './buffering-coordinator';
import {
  OBSERVATIONAL_MEMORY_DEFAULTS,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  OBSERVATION_RETRIEVAL_INSTRUCTIONS,
} from './constants';

/**
 * Returns the parts from the latest step of a message (after the last step-start marker).
 * If no step-start marker exists, returns all parts.
 */
export function getLatestStepParts(parts: MastraDBMessage['content']['parts']): MastraDBMessage['content']['parts'] {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.type === 'step-start') {
      return parts.slice(i + 1);
    }
  }
  return parts;
}

/**
 * Returns true when a message contains at least one part with visible user/assistant
 * content (text, tool-invocation, reasoning, image, file).  Messages that only carry
 * internal `data-*` parts (buffering markers, observation markers, etc.) return false.
 */
function messageHasVisibleContent(msg: MastraDBMessage): boolean {
  const content = msg.content as { parts?: Array<{ type?: string }>; content?: string };
  if (content?.parts && Array.isArray(content.parts)) {
    return content.parts.some(p => {
      const t = p?.type;
      return t && !t.startsWith('data-') && t !== 'step-start';
    });
  }
  if (content?.content) return true;
  return false;
}

/**
 * Build a messageRange string from the first and last messages that have visible
 * content.  Falls back to the full array boundaries when every message is data-only.
 */
export function buildMessageRange(messages: MastraDBMessage[]): string {
  const first = messages.find(messageHasVisibleContent) ?? messages[0]!;
  const last = [...messages].reverse().find(messageHasVisibleContent) ?? messages[messages.length - 1]!;
  return `${first.id}:${last.id}`;
}

/**
 * Returns the unix-ms timestamp of the last non-data part in the last assistant
 * message, representing when the last visible LLM response completed. Used as the
 * last activity time for activateAfterIdle checks.
 */
export function getLastActivityFromMessages(messages?: MastraDBMessage[]): number | undefined {
  if (!messages) return undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'assistant') {
      continue;
    }

    if (!message.content || typeof message.content === 'string') {
      return message.createdAt ? new Date(message.createdAt).getTime() : undefined;
    }

    for (let j = message.content.parts.length - 1; j >= 0; j--) {
      const part = message.content.parts[j];
      if (!part || part.type?.startsWith('data-')) {
        continue;
      }

      if (part.createdAt !== undefined) {
        return part.createdAt;
      }
    }

    return message.createdAt ? new Date(message.createdAt).getTime() : undefined;
  }

  return undefined;
}

function formatModelContext(provider?: string, modelId?: string): string | undefined {
  if (provider && modelId) {
    return `${provider}/${modelId}`;
  }

  return modelId;
}

export function getLastModelFromMessages(messages?: MastraDBMessage[]): string | undefined {
  if (!messages) return undefined;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.role !== 'assistant' || !message.content || typeof message.content === 'string') {
      continue;
    }

    for (let j = message.content.parts.length - 1; j >= 0; j--) {
      const part = message.content.parts[j];
      if (part?.type === 'step-start' && typeof part.model === 'string' && part.model.length > 0) {
        return part.model;
      }
    }

    const metadata = message.content.metadata as { provider?: string; modelId?: string } | undefined;
    const model = formatModelContext(metadata?.provider, metadata?.modelId);
    if (model) {
      return model;
    }
  }

  return undefined;
}

export function getCurrentModel(model?: { provider?: string; modelId?: string }): string | undefined {
  return formatModelContext(model?.provider, model?.modelId);
}

export { didProviderChange } from './model-context';

function parseActivationTTL(value: number | string | undefined, fieldPath: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${fieldPath} must be a non-negative number of milliseconds or a duration string like "5m".`);
    }
    return value;
  }

  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(ms|msec|msecs|millisecond|milliseconds|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/i,
  );

  if (!match) {
    throw new Error(
      `${fieldPath} must be a non-negative number of milliseconds or a duration string like "5m" or "1hr".`,
    );
  }

  const rawAmount = match[1]!;
  const rawUnit = match[2]!;
  const amount = Number(rawAmount);
  const unit = rawUnit.toLowerCase();

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldPath} must be a non-negative number of milliseconds or a duration string like "5m".`);
  }

  const multiplier =
    unit === 'ms' || unit === 'msec' || unit === 'msecs' || unit === 'millisecond' || unit === 'milliseconds'
      ? 1
      : unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds'
        ? 1_000
        : unit === 'm' || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes'
          ? 60_000
          : 3_600_000;

  return amount * multiplier;
}

import { addRelativeTimeToObservations } from './date-utils';
import { omDebug, omError } from './debug';
import { createBufferingStartMarker, createActivationMarker } from './markers';
import {
  findLastCompletedObservationBoundary,
  getUnobservedParts,
  getBufferedChunks,
  stripThreadTags,
} from './message-utils';
import { ModelByInputTokens } from './model-by-input-tokens';
import { didProviderChange as hasProviderChanged } from './model-context';
import { renderObservationGroupsForReflection, wrapInObservationGroup } from './observation-groups';
import { ObservationStrategy } from './observation-strategies/index';
import { ObservationTurn } from './observation-turn/index';
import type { ObservationTurnHooks } from './observation-turn/types';
import { optimizeObservationsForContext, formatMessagesForObserver } from './observer-agent';
import { ObserverRunner } from './observer-runner';
import { registerOp, unregisterOp, isOpActiveInProcess } from './operation-registry';
import type { CompressionLevel } from './reflector-agent';
import { ReflectorRunner } from './reflector-runner';
import { isOmReproCaptureEnabled, writeObserverExchangeReproCapture } from './repro-capture';
import {
  calculateDynamicThreshold,
  calculateProjectedMessageRemoval,
  getMaxThreshold,
  resolveActivationRatio,
  resolveBlockAfter,
  resolveBufferTokens,
} from './thresholds';
import { TokenCounter } from './token-counter';
import type { TokenCounterModelContext } from './token-counter';
import type {
  DataOmStatusPart,
  ObservationDebugEvent,
  ObservationalMemoryConfig,
  ObservationalMemoryModel,
  ObserveHookUsage,
  ObserveHooks,
  ResolvedObservationConfig,
  ResolvedReflectionConfig,
  ThresholdRange,
  ObservationMarkerConfig,
  ObservationModelContext,
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
  /** Whether retrieval-mode observation groups are enabled. */
  readonly retrieval: boolean;
  private observationConfig: ResolvedObservationConfig;
  private reflectionConfig: ResolvedReflectionConfig;
  private onDebugEvent?: (event: ObservationDebugEvent) => void;
  readonly onIndexObservations?: (observation: {
    text: string;
    groupId: string;
    range: string;
    threadId: string;
    resourceId: string;
    observedAt?: Date;
  }) => Promise<void>;

  /** Observer agent runner — handles LLM calls for extracting observations. */
  readonly observer: ObserverRunner;

  /** Reflector agent runner — handles LLM calls for compressing observations. */
  readonly reflector: ReflectorRunner;

  /** Buffering state coordinator — manages static maps and buffering lifecycle. */
  readonly buffering: BufferingCoordinator;

  private shouldObscureThreadIds = false;
  private hasher = xxhash();
  private mastra?: Mastra;

  /**
   * Track message IDs observed during this instance's lifetime.
   * Prevents re-observing messages when per-thread lastObservedAt cursors
   * haven't fully advanced past messages observed in a prior cycle.
   * @internal Used by observation strategies. Do not call directly.
   */
  observedMessageIds = new Set<string>();

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
    this.retrieval = Boolean(config.retrieval);
    this.onIndexObservations = config.onIndexObservations;
    this.mastra = config.mastra;

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

    const isDefaultModelSelection = (model: ObservationalMemoryModel | undefined) =>
      model === undefined || model === 'default' || model instanceof ModelByInputTokens;

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
      activateAfterIdle: parseActivationTTL(config.activateAfterIdle, 'activateAfterIdle'),
      activateOnProviderChange: config.activateOnProviderChange ?? false,
      blockAfter: asyncBufferingDisabled
        ? undefined
        : resolveBlockAfter(
            config.observation?.blockAfter ??
              ((config.observation?.bufferTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferTokens)
                ? 1.2
                : undefined),
            config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
          ),
      previousObserverTokens: config.observation?.previousObserverTokens ?? 2000,
      instruction: config.observation?.instruction,
      threadTitle: config.observation?.threadTitle ?? false,
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
      activateAfterIdle: parseActivationTTL(config.activateAfterIdle, 'activateAfterIdle'),
      activateOnProviderChange: config.activateOnProviderChange ?? false,
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

    this.tokenCounter = new TokenCounter({
      model: typeof observationModel === 'string' ? observationModel : undefined,
    });
    this.onDebugEvent = config.onDebugEvent;

    // Create internal MessageHistory for message persistence
    // OM handles message saving itself (in processOutputStep) instead of relying on
    // the Memory class's MessageHistory processor
    this.messageHistory = new MessageHistory({ storage: this.storage });

    this.observer = new ObserverRunner({
      observationConfig: this.observationConfig,
      observedMessageIds: this.observedMessageIds,
      resolveModel: inputTokens => this.resolveObservationModel(inputTokens),
      tokenCounter: this.tokenCounter,
      mastra: config.mastra,
    });

    this.buffering = new BufferingCoordinator({
      observationConfig: this.observationConfig,
      reflectionConfig: this.reflectionConfig,
      scope: this.scope,
    });

    this.reflector = new ReflectorRunner({
      reflectionConfig: this.reflectionConfig,
      observationConfig: this.observationConfig,
      tokenCounter: this.tokenCounter,
      storage: this.storage,
      scope: this.scope,
      buffering: this.buffering,
      emitDebugEvent: e => this.emitDebugEvent(e),
      persistMarkerToStorage: (m, t, r) => this.persistMarkerToStorage(m, t, r),
      persistMarkerToMessage: (m, ml, t, r) => this.persistMarkerToMessage(m, ml, t, r),
      getCompressionStartLevel: rc => this.getCompressionStartLevel(rc),
      resolveModel: inputTokens => this.resolveReflectionModel(inputTokens),
      mastra: config.mastra,
    });

    // Validate buffer configuration
    this.validateBufferConfig();

    omDebug(
      `[OM:init] new ObservationalMemory instance created — scope=${this.scope}, messageTokens=${JSON.stringify(this.observationConfig.messageTokens)}, obsAsyncEnabled=${this.buffering.isAsyncObservationEnabled()}, bufferTokens=${this.observationConfig.bufferTokens}, bufferActivation=${this.observationConfig.bufferActivation}, blockAfter=${this.observationConfig.blockAfter}, reflectionTokens=${this.reflectionConfig.observationTokens}, refAsyncEnabled=${this.buffering.isAsyncReflectionEnabled()}, refAsyncActivation=${this.reflectionConfig.bufferActivation}, refBlockAfter=${this.reflectionConfig.blockAfter}`,
    );
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
    this.observer.__registerMastra(mastra);
    this.reflector.__registerMastra(mastra);
  }

  /**
   * Get the current configuration for this OM instance.
   * Used by the server to expose config to the UI when OM is added via processors.
   */
  get config(): {
    scope: 'resource' | 'thread';
    retrieval: boolean;
    observation: {
      messageTokens: number | ThresholdRange;
      previousObserverTokens: number | false | undefined;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
    };
  } {
    return {
      scope: this.scope,
      retrieval: this.retrieval,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
        previousObserverTokens: this.observationConfig.previousObserverTokens,
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
    return BufferingCoordinator.awaitBuffering(threadId, resourceId, this.scope, timeoutMs);
  }

  private getConcreteModel(
    model: ObservationalMemoryModel,
    inputTokens?: number,
  ): Exclude<ObservationalMemoryModel, ModelByInputTokens> {
    if (model instanceof ModelByInputTokens) {
      if (inputTokens === undefined) {
        throw new Error('ModelByInputTokens requires inputTokens for resolution');
      }
      return model.resolve(inputTokens) as Exclude<ObservationalMemoryModel, ModelByInputTokens>;
    }

    return model as Exclude<ObservationalMemoryModel, ModelByInputTokens>;
  }

  private getModelToResolve(
    model: ObservationalMemoryModel,
    inputTokens?: number,
  ): Parameters<typeof resolveModelConfig>[0] {
    const concreteModel = this.getConcreteModel(model, inputTokens);

    if (Array.isArray(concreteModel)) {
      return (concreteModel[0]?.model ?? 'unknown') as Parameters<typeof resolveModelConfig>[0];
    }
    if (typeof concreteModel === 'function') {
      // Wrap to handle functions that may return ModelWithRetries[]
      return async (ctx: any) => {
        const result = await concreteModel(ctx);
        if (Array.isArray(result)) {
          return (result[0]?.model ?? 'unknown') as MastraModelConfig;
        }
        return result as MastraModelConfig;
      };
    }
    return concreteModel;
  }

  private formatModelName(model: TokenCounterModelContext) {
    if (!model.modelId) {
      return '(unknown)';
    }

    return model.provider ? `${model.provider}/${model.modelId}` : model.modelId;
  }

  private resolveObservationModel(inputTokens: number): {
    model: Exclude<ResolvedObservationConfig['model'], ModelByInputTokens>;
    selectedThreshold?: number;
    routingStrategy?: 'model-by-input-tokens';
    routingThresholds?: string;
  } {
    return this.resolveTieredModel(this.observationConfig.model, inputTokens);
  }

  private resolveReflectionModel(inputTokens: number): {
    model: Exclude<ResolvedReflectionConfig['model'], ModelByInputTokens>;
    selectedThreshold?: number;
    routingStrategy?: 'model-by-input-tokens';
    routingThresholds?: string;
  } {
    return this.resolveTieredModel(this.reflectionConfig.model, inputTokens);
  }

  private resolveTieredModel<TModel extends ObservationalMemoryModel>(
    model: TModel,
    inputTokens: number,
  ): {
    model: Exclude<TModel, ModelByInputTokens>;
    selectedThreshold?: number;
    routingStrategy?: 'model-by-input-tokens';
    routingThresholds?: string;
  } {
    if (!(model instanceof ModelByInputTokens)) {
      return {
        model: model as Exclude<TModel, ModelByInputTokens>,
      };
    }

    const thresholds = model.getThresholds();
    const selectedThreshold = thresholds.find(upTo => inputTokens <= upTo) ?? thresholds.at(-1);

    return {
      model: model.resolve(inputTokens) as Exclude<TModel, ModelByInputTokens>,
      selectedThreshold,
      routingStrategy: 'model-by-input-tokens',
      routingThresholds: thresholds.join(','),
    };
  }

  private async resolveModelRouting(
    modelConfig: ObservationalMemoryModel,
    requestContext?: RequestContext,
  ): Promise<{ model: string; routing?: Array<{ upTo: number; model: string }> }> {
    try {
      if (modelConfig instanceof ModelByInputTokens) {
        const routing = await Promise.all(
          modelConfig.getThresholds().map(async upTo => {
            const resolvedModel = modelConfig.resolve(upTo) as Exclude<ObservationalMemoryModel, ModelByInputTokens>;
            const resolved = await this.resolveModelContext(resolvedModel, requestContext);

            return {
              upTo,
              model: resolved?.modelId ? this.formatModelName(resolved) : '(unknown)',
            };
          }),
        );

        return {
          model: routing[0]?.model ?? '(unknown)',
          routing,
        };
      }

      const resolved = await this.resolveModelContext(modelConfig, requestContext);
      return {
        model: resolved?.modelId ? this.formatModelName(resolved) : '(unknown)',
      };
    } catch (error) {
      omError('[OM] Failed to resolve model config', error);
      return { model: '(unknown)' };
    }
  }

  private async resolveModelContext(
    modelConfig: ObservationalMemoryModel,
    requestContext?: RequestContext,
    inputTokens?: number,
  ): Promise<TokenCounterModelContext | undefined> {
    const modelToResolve = this.getModelToResolve(modelConfig, inputTokens);
    if (!modelToResolve) {
      return undefined;
    }

    const resolved = await resolveModelConfig(modelToResolve, requestContext, this.mastra);
    return {
      provider: resolved.provider,
      modelId: resolved.modelId,
    };
  }

  /**
   * Get the default compression start level based on model behavior.
   * gemini-2.5-flash is a faithful transcriber that needs explicit pressure to compress effectively.
   */
  async getCompressionStartLevel(requestContext?: RequestContext): Promise<CompressionLevel> {
    try {
      const resolved = await this.resolveModelContext(this.reflectionConfig.model, requestContext);
      const modelId = resolved?.modelId ?? '';

      // gemini-2.5-flash is conservative about compression - start at level 2
      if (modelId.includes('gemini-2.5-flash')) {
        return 2;
      }

      // Default for all other models
      return 1;
    } catch {
      // Silently fallback to level 1 on error - not worth disrupting the operation
      return 1; // safe default
    }
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
      previousObserverTokens: number | false | undefined;
      routing?: Array<{ upTo: number; model: string }>;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
      model: string;
      routing?: Array<{ upTo: number; model: string }>;
    };
  }> {
    const [observationResolved, reflectionResolved] = await Promise.all([
      this.resolveModelRouting(this.observationConfig.model, requestContext),
      this.resolveModelRouting(this.reflectionConfig.model, requestContext),
    ]);

    return {
      scope: this.scope,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
        model: observationResolved.model,
        previousObserverTokens: this.observationConfig.previousObserverTokens,
        routing: observationResolved.routing,
      },
      reflection: {
        observationTokens: this.reflectionConfig.observationTokens,
        model: reflectionResolved.model,
        routing: reflectionResolved.routing,
      },
    };
  }

  /**
   * Emit a debug event if the callback is configured.
   * @internal Used by observation strategies. Do not call directly.
   */
  emitDebugEvent(event: ObservationDebugEvent): void {
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

    // Validate observer context optimization options
    if (
      this.observationConfig.previousObserverTokens !== undefined &&
      this.observationConfig.previousObserverTokens !== false
    ) {
      if (
        !Number.isFinite(this.observationConfig.previousObserverTokens) ||
        this.observationConfig.previousObserverTokens < 0
      ) {
        throw new Error(
          `observation.previousObserverTokens must be false or a finite number >= 0, got ${this.observationConfig.previousObserverTokens}`,
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
   * Resolve the effective messageTokens for a record.
   * Only explicit per-record overrides (stored under `_overrides`) win;
   * the initial config snapshot written by getOrCreateRecord() is ignored
   * so that later instance-level changes still take effect.
   *
   * Overrides that fall below the instance-level buffering floor
   * (bufferTokens / absolute bufferActivation) are clamped to the
   * instance threshold to preserve buffering invariants.
   */
  private getEffectiveMessageTokens(record: ObservationalMemoryRecord): number | ThresholdRange {
    const overrides = (record.config as { _overrides?: { observation?: { messageTokens?: number | ThresholdRange } } })
      ?._overrides;
    const recordTokens = overrides?.observation?.messageTokens;
    if (recordTokens) {
      const maxOverride = getMaxThreshold(recordTokens);

      // Clamp: override must not violate instance-level buffering invariants
      const bufferTokens = this.observationConfig.bufferTokens;
      if (bufferTokens && maxOverride <= bufferTokens) {
        return this.observationConfig.messageTokens;
      }
      const bufferActivation = this.observationConfig.bufferActivation;
      if (bufferActivation && bufferActivation >= 1000 && maxOverride <= bufferActivation) {
        return this.observationConfig.messageTokens;
      }

      return recordTokens;
    }
    return this.observationConfig.messageTokens;
  }

  /**
   * Resolve the effective reflection observationTokens for a record.
   * Only explicit per-record overrides (stored under `_overrides`) win;
   * the initial config snapshot is ignored so instance-level changes
   * still take effect for existing records.
   */
  private getEffectiveReflectionTokens(record: ObservationalMemoryRecord): number | ThresholdRange {
    const overrides = (
      record.config as { _overrides?: { reflection?: { observationTokens?: number | ThresholdRange } } }
    )?._overrides;
    const recordTokens = overrides?.reflection?.observationTokens;
    if (recordTokens) {
      return recordTokens;
    }
    return this.reflectionConfig.observationTokens;
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
    const threshold = calculateDynamicThreshold(this.getEffectiveMessageTokens(record), currentObservationTokens);
    return pendingTokens >= threshold;
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
      activateAfterIdle: this.observationConfig.activateAfterIdle,
    };
  }

  /**
   * Persist a data-om-* marker part on the last assistant message in messageList
   * AND save the updated message to the DB so it survives page reload.
   * (data-* parts are filtered out before sending to the LLM, so they don't affect model calls.)
   * @internal Used by ReflectorRunner. Do not call directly.
   */
  async persistMarkerToMessage(
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
   * @internal Used by observation strategies. Do not call directly.
   */
  async persistMarkerToStorage(
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
  /** @internal Used by ObservationStep. */
  sealMessagesForBuffering(messages: MastraDBMessage[]): void {
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
   * Create a virtual message containing only the unobserved parts.
   * This is used for token counting and observation.
   */
  private createUnobservedMessage(message: MastraDBMessage): MastraDBMessage | null {
    const unobservedParts = getUnobservedParts(message);
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
  /** @internal Used by ObservationStep. */
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
      const bufferedChunks = getBufferedChunks(record);
      for (const chunk of bufferedChunks) {
        if (Array.isArray(chunk.messageIds)) {
          for (const id of chunk.messageIds) {
            observedMessageIds.add(id);
          }
        }
      }
    }

    const result: MastraDBMessage[] = [];

    for (const msg of allMessages) {
      // First check: skip if this message ID was already observed (safeguard against re-observation)
      if (observedMessageIds?.has(msg.id)) {
        continue;
      }

      // Check if this message has a completed observation
      const endMarkerIndex = findLastCompletedObservationBoundary(msg);
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
   * Prepare optimized observer context by applying truncation and buffered-reflection inclusion.
   *
   * Returns the (possibly optimized) observations string to pass as "Previous Observations"
   * to the observer prompt. When no optimization options are set, returns the input unchanged.
   */
  prepareObserverContext(
    existingObservations: string | undefined,
    record?: ObservationalMemoryRecord | null,
  ): { context: string | undefined; wasTruncated: boolean } {
    const { previousObserverTokens } = this.observationConfig;
    const tokenBudget =
      previousObserverTokens === undefined || previousObserverTokens === false ? undefined : previousObserverTokens;

    // Fast path: no optimization configured — preserve legacy behavior
    if (tokenBudget === undefined) {
      return { context: existingObservations, wasTruncated: false };
    }

    // When previousObserverTokens is enabled, also use buffered reflections
    const bufferedReflection =
      record?.bufferedReflection && record?.reflectedObservationLineCount ? record.bufferedReflection : undefined;

    if (!existingObservations) {
      return { context: bufferedReflection, wasTruncated: false };
    }

    // 1. Replace reflected observation lines with the buffered reflection summary.
    //    reflectedObservationLineCount tracks how many of the oldest lines
    //    were already summarized by the reflection — swap those out.
    let observations = existingObservations;
    if (bufferedReflection && record?.reflectedObservationLineCount) {
      const allLines = observations.split('\n');
      const unreflectedLines = allLines.slice(record.reflectedObservationLineCount);
      const unreflectedContent = unreflectedLines.join('\n').trim();
      observations = unreflectedContent ? `${bufferedReflection}\n\n${unreflectedContent}` : bufferedReflection;
    }

    // 2. Truncate the assembled result to fit within budget
    let wasTruncated = false;
    if (tokenBudget !== undefined) {
      if (tokenBudget === 0) {
        return { context: '', wasTruncated: true };
      }

      const currentTokens = this.tokenCounter.countObservations(observations);
      if (currentTokens > tokenBudget) {
        observations = this.truncateObservationsToTokenBudget(observations, tokenBudget);
        wasTruncated = true;
      }
    }

    return { context: observations, wasTruncated };
  }

  /**
   * Truncate observations to fit within a token budget.
   *
   * Strategy:
   * 1. Keep a raw tail of recent observations (end of block).
   * 2. Add a truncation marker: [X observations truncated here], placed at the hidden gap.
   * 3. Try to preserve important observations (🔴) from older context, newest-first.
   * 4. Enforce that at least 50% of kept observations remain raw tail observations.
   */
  private truncateObservationsToTokenBudget(observations: string, budget: number): string {
    if (budget === 0) {
      return '';
    }

    const totalTokens = this.tokenCounter.countObservations(observations);
    if (totalTokens <= budget) {
      return observations;
    }

    const lines = observations.split('\n');
    const totalCount = lines.length;

    // tokenx is lightweight (regex-based), so measure each line directly.
    const lineTokens: number[] = new Array(totalCount);
    const isImportant: boolean[] = new Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      lineTokens[i] = this.tokenCounter.countString(lines[i]!);
      isImportant[i] = lines[i]!.includes('🔴') || lines[i]!.includes('✅');
    }

    // Precompute suffix sums so tail cost is O(1).
    const suffixTokens: number[] = new Array(totalCount + 1);
    suffixTokens[totalCount] = 0;
    for (let i = totalCount - 1; i >= 0; i--) {
      suffixTokens[i] = suffixTokens[i + 1]! + lineTokens[i]!;
    }

    // Collect important-line indexes from the head region.
    // Built incrementally as tailStart advances.
    const headImportantIndexes: number[] = [];

    const buildCandidateString = (tailStart: number, selectedImportantIndexes: number[]) => {
      const keptIndexes = [
        ...selectedImportantIndexes,
        ...Array.from({ length: totalCount - tailStart }, (_, i) => tailStart + i),
      ].sort((a, b) => a - b);

      if (keptIndexes.length === 0) {
        return `[${totalCount} observations truncated here]`;
      }

      const outputLines: string[] = [];
      let previousKeptIndex = -1;

      for (const keptIndex of keptIndexes) {
        const hiddenCount = keptIndex - previousKeptIndex - 1;
        if (hiddenCount === 1) {
          // Keep the original line — the marker would cost more tokens than the line itself
          outputLines.push(lines[previousKeptIndex + 1]!);
        } else if (hiddenCount > 1) {
          outputLines.push(`[${hiddenCount} observations truncated here]`);
        }
        outputLines.push(lines[keptIndex]!);
        previousKeptIndex = keptIndex;
      }

      const trailingHiddenCount = totalCount - previousKeptIndex - 1;
      if (trailingHiddenCount === 1) {
        outputLines.push(lines[totalCount - 1]!);
      } else if (trailingHiddenCount > 1) {
        outputLines.push(`[${trailingHiddenCount} observations truncated here]`);
      }

      return outputLines.join('\n');
    };

    // Lower-bound cost of kept content (excludes marker lines).
    // Used for fast rejection — the final countObservations call is the real gatekeeper.
    const estimateKeptContentCost = (tailStart: number, selectedImportantIndexes: number[]): number => {
      let cost = suffixTokens[tailStart]!;
      for (const idx of selectedImportantIndexes) {
        cost += lineTokens[idx]!;
      }
      return cost;
    };

    let bestCandidate: string | undefined;
    let bestImportantCount = -1;
    let bestRawTailLength = -1;

    for (let tailStart = 1; tailStart < totalCount; tailStart++) {
      // Incrementally track important lines in the head region.
      if (isImportant[tailStart - 1]) {
        headImportantIndexes.push(tailStart - 1);
      }

      const rawTailLength = totalCount - tailStart;
      const maxImportantByRatio = rawTailLength;
      let importantToKeep = Math.min(headImportantIndexes.length, maxImportantByRatio);

      const getSelectedImportant = (count: number) =>
        count > 0 ? headImportantIndexes.slice(Math.max(0, headImportantIndexes.length - count)) : [];

      // Fast rejection: drop important lines if even the kept content exceeds budget.
      while (
        importantToKeep > 0 &&
        estimateKeptContentCost(tailStart, getSelectedImportant(importantToKeep)) > budget
      ) {
        importantToKeep -= 1;
      }

      if (estimateKeptContentCost(tailStart, getSelectedImportant(importantToKeep)) > budget) {
        continue;
      }

      // Only build + verify when this candidate could beat the current best.
      if (
        importantToKeep > bestImportantCount ||
        (importantToKeep === bestImportantCount && rawTailLength > bestRawTailLength)
      ) {
        const candidate = buildCandidateString(tailStart, getSelectedImportant(importantToKeep));
        if (this.tokenCounter.countObservations(candidate) <= budget) {
          bestCandidate = candidate;
          bestImportantCount = importantToKeep;
          bestRawTailLength = rawTailLength;
        }
      }
    }

    if (!bestCandidate) {
      return `[${totalCount} observations truncated here]`;
    }

    return bestCandidate;
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
    currentTask?: string,
    suggestedResponse?: string,
    unobservedContextBlocks?: string,
    currentDate?: Date,
    retrieval = false,
  ): string[] {
    // Optimize observations to save tokens unless retrieval mode needs durable group metadata preserved.
    let optimized = retrieval
      ? (renderObservationGroupsForReflection(observations) ?? optimizeObservationsForContext(observations))
      : optimizeObservationsForContext(observations);

    // Add relative time annotations to date headers if currentDate is provided
    if (currentDate) {
      optimized = addRelativeTimeToObservations(optimized, currentDate);
    }

    const messages = [
      `${OBSERVATION_CONTEXT_PROMPT}\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}${retrieval ? `\n\n${OBSERVATION_RETRIEVAL_INSTRUCTIONS}` : ''}`,
    ];

    // Add unobserved context from other threads (resource scope only)
    if (unobservedContextBlocks) {
      messages.push(
        `The following content is from OTHER conversations different from the current conversation, they're here for reference,  but they're not necessarily your focus:\nSTART_OTHER_CONVERSATIONS_BLOCK\n${unobservedContextBlocks}\nEND_OTHER_CONVERSATIONS_BLOCK`,
      );
    }

    const observationChunks = this.splitObservationContextChunks(optimized);
    if (observationChunks.length > 0) {
      messages.push('<observations>', ...observationChunks);
    }

    // Dynamically inject current-task from thread metadata (not stored in observations)
    if (currentTask) {
      messages.push(`<current-task>\n${currentTask}\n</current-task>`);
    }

    if (suggestedResponse) {
      messages.push(`<suggested-response>\n${suggestedResponse}\n</suggested-response>`);
    }

    return messages;
  }

  private splitObservationContextChunks(observations: string): string[] {
    const trimmed = observations.trim();
    if (!trimmed) {
      return [];
    }

    return trimmed
      .split(/\n{2,}--- message boundary \(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\) ---\n{2,}/)
      .map(chunk => chunk.trim())
      .filter(Boolean);
  }

  /**
   * Create a message boundary delimiter with an ISO 8601 date.
   * The date should be the lastObservedAt timestamp — the latest message
   * timestamp that was observed to produce the observations following this boundary.
   */
  static createMessageBoundary(date: Date): string {
    return `\n\n--- message boundary (${date.toISOString()}) ---\n\n`;
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
   * Save messages to storage, skipping messages that were already persisted by
   * async buffering. Uses the message-level sealed flag (metadata.mastra.sealed)
   * to detect already-persisted messages, avoiding redundant DB operations.
   *
   * Messages with observation markers are always saved (upserted) even if sealed,
   * because the markers need to be persisted to storage.
   */
  async persistMessages(
    messagesToSave: MastraDBMessage[],
    threadId: string,
    resourceId: string | undefined,
  ): Promise<void> {
    const filteredMessages: MastraDBMessage[] = [];
    for (const msg of messagesToSave) {
      const isSealed = !!(msg.content?.metadata as { mastra?: { sealed?: boolean } })?.mastra?.sealed;
      if (isSealed) {
        // Sealed messages were already persisted by buffer(). Only re-save if they
        // now have observation markers (need to upsert the markers to storage).
        if (findLastCompletedObservationBoundary(msg) !== -1) {
          filteredMessages.push(msg);
        }
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
  }

  /**
   * Load messages from storage that haven't been observed yet.
   * Uses cursor-based query with lastObservedAt timestamp for efficiency.
   *
   * In resource scope mode, loads messages for the entire resource (all threads).
   * In thread scope mode, loads messages for just the current thread.
   */
  private async loadMessagesFromStorage(
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
      const hasher = await this.hasher;
      return hasher.h32ToString(threadId);
    }
    return threadId;
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
   * Wrap observations in a thread attribution tag.
   * Used in resource scope to track which thread observations came from.
   * @internal Used by observation strategies. Do not call directly.
   */
  async wrapWithThreadTag(threadId: string, observations: string, messageRange?: string): Promise<string> {
    // First strip any thread tags the Observer might have added
    const cleanObservations = stripThreadTags(observations);
    const groupedObservations =
      this.retrieval && messageRange ? wrapInObservationGroup(cleanObservations, messageRange) : cleanObservations;
    const obscuredId = await this.representThreadIDInContext(threadId);
    return `<thread id="${obscuredId}">\n${groupedObservations}\n</thread>`;
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
    lastObservedAt: Date,
  ): string {
    if (!existingObservations) {
      return newThreadSection;
    }

    // Extract thread ID and date from new section
    const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
    const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

    if (!threadIdMatch || !dateMatch) {
      // Can't parse, just append with message boundary for cache stability
      return `${existingObservations}${ObservationalMemory.createMessageBoundary(lastObservedAt)}${newThreadSection}`;
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

    // No existing section with same thread ID and date - append with message boundary for cache stability
    return `${existingObservations}${ObservationalMemory.createMessageBoundary(lastObservedAt)}${newThreadSection}`;
  }

  /**
   * @internal Used by observation strategies. Do not call directly.
   */
  wrapObservations(
    rawObservations: string,
    existingObservations: string,
    threadId: string,
    lastObservedAt?: Date,
    messageRange?: string,
  ): Promise<string> | string {
    if (this.scope === 'resource') {
      return (async () => {
        const threadSection = await this.wrapWithThreadTag(threadId, rawObservations, messageRange);
        return this.replaceOrAppendThreadSection(
          existingObservations,
          threadId,
          threadSection,
          lastObservedAt ?? new Date(),
        );
      })();
    }
    const grouped =
      this.retrieval && messageRange ? wrapInObservationGroup(rawObservations, messageRange) : rawObservations;
    return existingObservations ? `${existingObservations}\n\n${grouped}` : grouped;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Observation methods
  // ────────────────────────────────────────────────────────────────────────

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
    observabilityContext?: ObservabilityContext,
  ): Promise<void> {
    const bufferKey = this.buffering.getObservationBufferKey(lockKey);

    // Update the last buffered boundary (in-memory for current instance).
    // Use contextWindowTokens (all messages in context) to match the scale of
    // totalPendingTokens passed to shouldTriggerAsyncObservation.
    const currentTokens =
      contextWindowTokens ??
      (await this.tokenCounter.countMessagesAsync(unobservedMessages)) + (record.pendingMessageTokens ?? 0);
    BufferingCoordinator.lastBufferedBoundary.set(bufferKey, currentTokens);

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
      observabilityContext,
    ).finally(() => {
      // Clean up the operation tracking
      BufferingCoordinator.asyncBufferingOps.delete(bufferKey);
      // Clear persistent flag
      unregisterOp(record.id, 'bufferingObservation');
      this.storage.setBufferingObservationFlag(record.id, false).catch(err => {
        omError('[OM] Failed to clear buffering observation flag', err);
      });
    });

    BufferingCoordinator.asyncBufferingOps.set(bufferKey, asyncOp);
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
    observabilityContext?: ObservabilityContext,
  ): Promise<void> {
    // Wait for any existing buffering operation to complete first (mutex behavior)
    const existingOp = BufferingCoordinator.asyncBufferingOps.get(bufferKey);
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
    let bufferCursor = BufferingCoordinator.lastBufferedAtTime.get(bufferKey) ?? freshRecord.lastBufferedAtTime ?? null;

    // Advance the cursor if lastObservedAt is newer (e.g. sync observation ran after the last buffer)
    if (freshRecord.lastObservedAt) {
      const lastObserved = new Date(freshRecord.lastObservedAt);
      if (!bufferCursor || lastObserved > bufferCursor) {
        bufferCursor = lastObserved;
      }
    }

    // Filter messages to only those newer than the buffer cursor.
    // This prevents re-buffering messages that were already included in a previous chunk.
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

    // Generate cycle ID and capture start time
    const cycleId = `buffer-obs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startedAt = new Date().toISOString();
    const tokensToBuffer = await this.tokenCounter.countMessagesAsync(messagesToBuffer);

    const startMarker = createBufferingStartMarker({
      cycleId,
      operationType: 'observation',
      tokensToBuffer,
      recordId: freshRecord.id,
      threadId,
      threadIds: [threadId],
      config: this.getObservationMarkerConfig(),
    });
    await this.persistMarkerToStorage(startMarker, threadId, freshRecord.resourceId ?? undefined);

    // Emit buffering start marker without letting the stream writer create a separate data-only DB message.
    if (writer) {
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void writer.custom({ ...startMarker, transient: true }).catch(() => {});
    }

    omDebug(
      `[OM:bufferInput] cycleId=${cycleId}, msgCount=${messagesToBuffer.length}, msgTokens=${tokensToBuffer}, ids=${messagesToBuffer.map(m => `${m.id?.slice(0, 8)}@${m.createdAt ? new Date(m.createdAt).toISOString() : 'none'}`).join(',')}`,
    );

    await ObservationStrategy.create(this, {
      record: freshRecord,
      threadId,
      resourceId: freshRecord.resourceId ?? undefined,
      messages: messagesToBuffer,
      cycleId,
      startedAt,
      writer,
      requestContext,
      observabilityContext,
    }).run();

    // Update the buffer cursor so the next buffer only sees messages newer than this one.
    const maxTs = this.getMaxMessageTimestamp(messagesToBuffer);
    const cursor = new Date(maxTs.getTime() + 1);
    BufferingCoordinator.lastBufferedAtTime.set(bufferKey, cursor);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL API — semantic operations for programmatic use
  // ════════════════════════════════════════════════════════════════════════════

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
    observabilityContext?: ObservabilityContext;
  }): Promise<boolean> {
    if (!this.buffering.isAsyncObservationEnabled()) return false;

    const lockKey = this.buffering.getLockKey(opts.threadId, opts.resourceId);
    const shouldTrigger = this.buffering.shouldTriggerAsyncObservation(
      opts.pendingTokens,
      lockKey,
      opts.record,
      this.storage,
      opts.threshold,
    );

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

  private isMessageList(value: MessageList | MastraDBMessage[]): value is MessageList {
    return !!value && typeof value === 'object' && 'get' in value && 'removeByIds' in value;
  }

  private removeIdsFromArray(messages: MastraDBMessage[], ids: string[]) {
    if (ids.length === 0) return;
    const idsSet = new Set(ids);
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.id && idsSet.has(msg.id)) {
        messages.splice(i, 1);
      }
    }
  }

  /**
   * Mutate partially observed messages in place and return the fully observed
   * message IDs that should be removed from the live context.
   *
   * This is the shared activation-cleanup primitive used by both the processor
   * and AI SDK integrations: callers pass the current live messages, OM trims
   * any partially observed messages down to their unobserved parts, and OM
   * returns only the IDs that are safe to remove entirely.
   */
  async getObservedMessageIdsForCleanup(opts: {
    threadId: string;
    resourceId?: string;
    messages: MastraDBMessage[];
    observedMessageIds?: string[];
    retentionFloor?: number;
  }): Promise<string[]> {
    const { threadId, resourceId, messages, observedMessageIds, retentionFloor } = opts;

    const record = await this.getOrCreateRecord(threadId, resourceId);
    const effectiveObservedIds =
      observedMessageIds && observedMessageIds.length > 0
        ? observedMessageIds
        : Array.isArray(record.observedMessageIds)
          ? record.observedMessageIds
          : [];

    if (effectiveObservedIds.length === 0) {
      return [];
    }

    const observedSet = new Set(effectiveObservedIds);
    const idsToRemove = new Set<string>();
    const removalOrder: string[] = [];
    let skipped = 0;
    let backoffTriggered = false;
    const retentionCounter = typeof retentionFloor === 'number' ? new TokenCounter() : null;

    for (const msg of messages) {
      if (!msg?.id || msg.id === 'om-continuation' || !observedSet.has(msg.id)) continue;

      const unobservedParts = getUnobservedParts(msg);
      const totalParts = msg.content?.parts?.length ?? 0;

      if (unobservedParts.length > 0 && unobservedParts.length < totalParts) {
        msg.content.parts = unobservedParts;
        continue;
      }

      if (retentionCounter && typeof retentionFloor === 'number') {
        const nextRemainingMessages = messages.filter(
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
      let remainingMessages = messages.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
      let remainingTokens = retentionCounter.countMessages(remainingMessages);

      while (remainingTokens < retentionFloor && removalOrder.length > 0) {
        const restoreId = removalOrder.pop()!;
        idsToRemove.delete(restoreId);
        skipped += 1;
        backoffTriggered = true;
        remainingMessages = messages.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
        remainingTokens = retentionCounter.countMessages(remainingMessages);
      }
    }

    omDebug(
      `[OM:cleanupActivation] matched=${idsToRemove.size}, skipped=${skipped}, backoffTriggered=${backoffTriggered}`,
    );

    return [...idsToRemove];
  }

  /**
   * Clean up observed content from either a live MessageList or a plain message array.
   *
   * - MessageList input: mutates the live container in place and returns the remaining messages
   * - Array input: mutates the array in place and returns it
   *
   * This is the shared cleanup primitive intended for both processor and non-processor
   * integrations. The processor may still pass sealedIds/state so marker/fallback cleanup
   * can persist messages safely, but callers that do not need that bookkeeping can omit it.
   */
  /** @internal Used by ObservationStep. */
  async cleanupMessages(opts: {
    threadId: string;
    resourceId?: string;
    messages: MessageList | MastraDBMessage[];
    observedMessageIds?: string[];
    retentionFloor?: number;
  }): Promise<MastraDBMessage[]> {
    const { threadId, resourceId, observedMessageIds, retentionFloor } = opts;
    const messageList = this.isMessageList(opts.messages) ? opts.messages : undefined;
    const allMsgs: MastraDBMessage[] = messageList ? messageList.get.all.db() : (opts.messages as MastraDBMessage[]);

    let markerIdx = -1;
    let markerMsg: MastraDBMessage | null = null;

    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (!msg) continue;
      if (findLastCompletedObservationBoundary(msg) !== -1) {
        markerIdx = i;
        markerMsg = msg;
        break;
      }
    }

    omDebug(
      `[OM:cleanupBranch] allMsgs=${allMsgs.length}, markerFound=${markerIdx !== -1}, markerIdx=${markerIdx}, observedMessageIds=${observedMessageIds?.length ?? 'undefined'}`,
    );

    if (observedMessageIds && observedMessageIds.length > 0) {
      const idsToRemoveList = await this.getObservedMessageIdsForCleanup({
        threadId,
        resourceId,
        messages: allMsgs,
        observedMessageIds,
        retentionFloor,
      });

      if (messageList) {
        if (idsToRemoveList.length > 0) {
          messageList.removeByIds(idsToRemoveList);
        }
        return messageList.get.all.db();
      }

      this.removeIdsFromArray(allMsgs, idsToRemoveList);
      return allMsgs;
    }

    if (markerMsg && markerIdx !== -1) {
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

      const unobservedParts = getUnobservedParts(markerMsg);
      if (unobservedParts.length === 0) {
        if (markerMsg.id) idsToRemove.push(markerMsg.id);
      } else if (unobservedParts.length < (markerMsg.content?.parts?.length ?? 0)) {
        markerMsg.content.parts = unobservedParts;
      }

      if (messageList) {
        if (idsToRemove.length > 0) {
          messageList.removeByIds(idsToRemove);
        }

        if (messagesToSave.length > 0) {
          await this.persistMessages(messagesToSave, threadId, resourceId);
        }

        omDebug(`[OM:cleanupMarker] removed ${idsToRemove.length} messages, saved ${messagesToSave.length}`);
        return messageList.get.all.db();
      }

      this.removeIdsFromArray(allMsgs, idsToRemove);
      return allMsgs;
    }

    // No observed IDs and no marker — nothing to clean up.
    // Return messages unchanged.
    return messageList ? messageList.get.all.db() : allMsgs;
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
    threadId: string;
    resourceId?: string;
    observedMessageIds?: string[];
    retentionFloor?: number;
  }): Promise<void> {
    const { messageList, threadId, resourceId, observedMessageIds, retentionFloor } = opts;
    await this.cleanupMessages({
      threadId,
      resourceId,
      messages: messageList,
      observedMessageIds,
      retentionFloor,
    });
  }

  /**
   * Reset buffering state after a successful observation activation.
   *
   * Clears the lastBufferedBoundary, buffering flag, and optionally cleans up
   * static maps for activated message IDs.
   */
  /** @internal Used by ObservationStep. */
  async resetBufferingState(opts: {
    threadId: string;
    resourceId?: string;
    recordId: string;
    activatedMessageIds?: string[];
  }): Promise<void> {
    const { threadId, resourceId, recordId, activatedMessageIds } = opts;
    const lockKey = this.buffering.getLockKey(threadId, resourceId);
    const bufKey = this.buffering.getObservationBufferKey(lockKey);

    BufferingCoordinator.lastBufferedBoundary.set(bufKey, 0);
    await this.storage.setBufferingObservationFlag(recordId, false, 0).catch(() => {});

    if (activatedMessageIds && activatedMessageIds.length > 0) {
      this.buffering.cleanupStaticMaps(threadId, resourceId, activatedMessageIds);
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
    const parts = await this.buildContextSystemMessages(opts);
    return parts?.join('\n\n');
  }

  /**
   * Build observation context as an array of system message chunks.
   * Each chunk is a separate system message for better LLM cache hit rates.
   * Used by the processor to inject multiple system messages.
   * @internal
   */
  async buildContextSystemMessages(opts: {
    threadId: string;
    resourceId?: string;
    record?: ObservationalMemoryRecord;
    unobservedContextBlocks?: string;
    currentDate?: Date;
  }): Promise<string[] | undefined> {
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
      this.retrieval,
    );
  }

  /**
   * Get unobserved messages from other threads for resource-scoped observation.
   *
   * Lists all threads for the resource, filters to unobserved messages,
   * and formats them as context blocks.
   */
  /** @internal Used by ObservationTurn. */
  async getOtherThreadsContext(resourceId: string, currentThreadId: string): Promise<string | undefined> {
    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId } });
    const messagesByThread = new Map<string, MastraDBMessage[]>();

    // Fetch the OM record once so we can fall back to its lastObservedAt
    // for threads whose metadata was never stamped.  See #15265.
    const record = await this.getRecord(currentThreadId, resourceId);
    const recordLastObservedAt = record?.lastObservedAt;

    for (const thread of allThreads) {
      if (thread.id === currentThreadId) continue;

      const omMetadata = getThreadOMMetadata(thread.metadata);
      const threadLastObservedAt = omMetadata?.lastObservedAt ?? recordLastObservedAt;
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
      const bufferedChunks = getBufferedChunks(record);
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);
      const rawBufferedMessageTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const bufferedMessageTokens = Math.min(rawBufferedMessageTokens, pendingTokens);

      const projectedMessageRemoval = calculateProjectedMessageRemoval(
        bufferedChunks,
        this.observationConfig.bufferActivation ?? 1,
        getMaxThreshold(this.getEffectiveMessageTokens(record)),
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
   * Get the current observation status for a thread/resource.
   *
   * Loads unobserved messages from storage, counts tokens, and checks against
   * configured thresholds. Returns a comprehensive status object that tells the
   * caller what actions are needed.
   *
   * This is a pure read operation with no side effects.
   *
   * @example
   * ```ts
   * const status = await om.getStatus({ threadId });
   * if (status.shouldObserve) {
   *   await om.observe({ threadId });
   * } else if (status.shouldBuffer) {
   *   await om.buffer({ threadId });
   * }
   * if (status.shouldReflect) {
   *   await om.reflect(threadId);
   * }
   * ```
   */
  async getStatus(opts: { threadId: string; resourceId?: string; messages?: MastraDBMessage[] }): Promise<{
    record: ObservationalMemoryRecord;
    pendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    unbufferedPendingTokens: number;
    shouldObserve: boolean;
    shouldBuffer: boolean;
    shouldReflect: boolean;
    bufferedChunkCount: number;
    bufferedChunkTokens: number;
    canActivate: boolean;
    asyncObservationEnabled: boolean;
    asyncReflectionEnabled: boolean;
    scope: 'resource' | 'thread';
  }> {
    const { threadId, resourceId } = opts;
    const record = await this.getOrCreateRecord(threadId, resourceId);
    const currentObservationTokens = record.observationTokenCount ?? 0;

    // Use provided messages or load from storage
    let unobservedMessages: MastraDBMessage[];
    if (opts.messages) {
      unobservedMessages = this.getUnobservedMessages(opts.messages, record);
    } else {
      const rawMessages = await this.loadMessagesFromStorage(
        threadId,
        resourceId,
        record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
      );
      unobservedMessages = this.getUnobservedMessages(rawMessages, record);
    }

    // Count tokens
    const contextWindowTokens = await this.tokenCounter.countMessagesAsync(unobservedMessages);
    let otherThreadTokens = 0;
    if (this.scope === 'resource' && resourceId) {
      const otherContext = await this.getOtherThreadsContext(resourceId, threadId);
      otherThreadTokens = otherContext ? this.tokenCounter.countString(otherContext) : 0;
    }
    const pendingTokens = Math.max(0, contextWindowTokens + otherThreadTokens);

    // Calculate observation threshold (use per-record override if set)
    const threshold = calculateDynamicThreshold(this.getEffectiveMessageTokens(record), currentObservationTokens);

    // Buffering status
    const bufferedChunks = getBufferedChunks(record);
    const bufferedChunkCount = bufferedChunks.length;
    const bufferedChunkTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);

    // Should buffer? Check interval boundary using DB-backed state
    const asyncObservationEnabled = this.buffering.isAsyncObservationEnabled();
    let shouldBuffer = false;
    if (asyncObservationEnabled && pendingTokens < threshold) {
      const lockKey = this.buffering.getLockKey(threadId, resourceId);
      shouldBuffer = this.buffering.shouldTriggerAsyncObservation(
        pendingTokens,
        lockKey,
        record,
        this.storage,
        threshold,
      );
    }

    // Should observe?
    const shouldObserve = pendingTokens >= threshold;

    // Should reflect? (use per-record override if set)
    const reflectThreshold = getMaxThreshold(this.getEffectiveReflectionTokens(record));
    const shouldReflect = currentObservationTokens >= reflectThreshold;

    // Can activate?
    const canActivate = bufferedChunkCount > 0;

    // Effective observation tokens threshold (for shared budget UI display)
    const effectiveMessageTokens = this.getEffectiveMessageTokens(record);
    const isSharedBudget = typeof effectiveMessageTokens !== 'number';
    const totalBudget = isSharedBudget ? (effectiveMessageTokens as { min: number; max: number }).max : 0;
    const effectiveObservationTokensThreshold = isSharedBudget
      ? Math.max(totalBudget - threshold, 1000)
      : reflectThreshold;

    const unbufferedPendingTokens = Math.max(0, pendingTokens - bufferedChunkTokens);

    return {
      record,
      pendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
      unbufferedPendingTokens,
      shouldObserve,
      shouldBuffer,
      shouldReflect,
      bufferedChunkCount,
      bufferedChunkTokens,
      canActivate,
      asyncObservationEnabled,
      asyncReflectionEnabled: this.buffering.isAsyncReflectionEnabled(),
      scope: this.scope,
    };
  }

  /**
   * Finalize the observation lifecycle: activate any remaining buffered chunks,
   * then observe if the threshold is crossed.
   *
   * Call this at the end of a conversation, session, or turn sequence to ensure
   * no buffered observations are left orphaned and the observation cursor is
   * advanced. Produces a clean terminal state (no pending chunks, cursor up to date).
   *
   * @example
   * ```ts
   * // After all turns are complete
   * const result = await om.finalize({ threadId });
   * // result.activated: true if buffered chunks were promoted
   * // result.observed: true if a full observation pass ran
   * ```
   */
  async finalize(opts: { threadId: string; resourceId?: string; messages?: MastraDBMessage[] }): Promise<{
    activated: boolean;
    observed: boolean;
    reflected: boolean;
    record: ObservationalMemoryRecord;
  }> {
    const { threadId, resourceId, messages } = opts;
    let activated = false;
    let observed = false;
    let reflected = false;

    // Wait for any in-flight buffer operations to complete
    await BufferingCoordinator.awaitBuffering(threadId, resourceId ?? null, this.scope);

    // Activate any remaining buffered chunks
    const preStatus = await this.getStatus({ threadId, resourceId, messages });
    if (preStatus.canActivate) {
      const actResult = await this.activate({ threadId, resourceId, messages });
      activated = actResult.activated;
    }

    // Observe if threshold is crossed (advances the cursor)
    const postStatus = await this.getStatus({ threadId, resourceId, messages });
    if (postStatus.shouldObserve) {
      const obsResult = await this.observe({ threadId, resourceId, messages });
      observed = obsResult.observed;
    }

    // Reflect if observation tokens exceed reflection threshold
    const reflectStatus = await this.getStatus({ threadId, resourceId });
    if (reflectStatus.shouldReflect) {
      const refResult = await this.reflect(threadId, resourceId);
      reflected = refResult.reflected;
    }

    const record = await this.getOrCreateRecord(threadId, resourceId);
    return { activated, observed, reflected, record };
  }

  /**
   * Return only the messages that haven't been fully observed yet.
   *
   * Use this to prune observed messages from an in-memory message array,
   * preventing unbounded context growth across steps in a multi-step loop.
   * This is the array-based equivalent of the processor's `cleanupObservedContext()`.
   *
   * @example
   * ```ts
   * // In a prepareStep hook, prune before sending to the model
   * messages = await om.pruneObserved({ threadId, messages });
   * ```
   */
  async pruneObserved(opts: {
    threadId: string;
    resourceId?: string;
    messages: MastraDBMessage[];
  }): Promise<MastraDBMessage[]> {
    const { threadId, resourceId, messages } = opts;
    const record = await this.getOrCreateRecord(threadId, resourceId);
    return this.getUnobservedMessages(messages, record);
  }

  /**
   * Load unobserved messages from storage for a thread/resource.
   *
   * Fetches the OM record, queries storage for messages after the
   * lastObservedAt cursor, then applies part-level filtering so
   * partially-observed messages only include their unobserved parts.
   *
   * Use this when you need to load stored conversation history that
   * hasn't been observed yet (e.g. in a stateless gateway proxy that
   * only receives the latest message from the HTTP request).
   */
  async loadUnobservedMessages(opts: { threadId: string; resourceId?: string }): Promise<MastraDBMessage[]> {
    const { threadId, resourceId } = opts;
    const record = await this.getOrCreateRecord(threadId, resourceId);
    const rawMessages = await this.loadMessagesFromStorage(
      threadId,
      resourceId,
      record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
    );
    return this.getUnobservedMessages(rawMessages, record);
  }

  /**
   * Create a buffered observation chunk without merging into active observations.
   *
   * Loads unobserved messages from storage (filtered by the buffer cursor to avoid
   * re-buffering), calls the observer LLM, and stores the result as a pending
   * buffered chunk in the DB. The chunk can later be merged into active observations
   * via `activate()`.
   *
   * This is a synchronous (awaited) operation — the caller decides whether to
   * `await` it or fire-and-forget. All state lives in storage; no in-process
   * coordination is needed.
   *
   * @example
   * ```ts
   * const status = await om.getStatus({ threadId });
   * if (status.shouldBuffer) {
   *   await om.buffer({ threadId });
   * }
   * ```
   */
  /** @internal Used by ObservationStep. */
  async buffer(opts: {
    threadId: string;
    resourceId?: string;
    messages?: MastraDBMessage[];
    /** The freshly-counted pending token count from the caller. If not provided,
     *  falls back to record.pendingMessageTokens (which may be stale). */
    pendingTokens?: number;
    /** Pre-loaded record to skip the initial getOrCreateRecord() fetch.
     *  When called fire-and-forget, passing the record avoids an async gap
     *  before lastBufferedBoundary is set. */
    record?: ObservationalMemoryRecord;
    writer?: ProcessorStreamWriter;
    requestContext?: RequestContext;
    observabilityContext?: ObservabilityContext;
    /** Called with the final candidate messages after cursor filtering, before the observer runs.
     *  Use this to seal messages in a live MessageList and persist them to storage. */
    beforeBuffer?: (candidates: MastraDBMessage[]) => Promise<void>;
  }): Promise<{
    buffered: boolean;
    record: ObservationalMemoryRecord;
  }> {
    const { threadId, resourceId, requestContext, observabilityContext } = opts;

    let record = opts.record ?? (await this.getOrCreateRecord(threadId, resourceId));

    // Check if buffering is enabled
    if (!this.buffering.isAsyncObservationEnabled()) {
      return { buffered: false, record };
    }

    // Check if another process is already buffering (and the op is genuinely active)
    if (record.isBufferingObservation && isOpActiveInProcess(record.id, 'bufferingObservation')) {
      return { buffered: false, record };
    }

    // Use the caller-provided pendingTokens if available (processor passes the freshly-counted
    // value from in-memory messages), otherwise fall back to the DB-stored value.
    const currentTokens = opts.pendingTokens ?? record.pendingMessageTokens ?? 0;
    const lockKey = this.buffering.getLockKey(threadId, resourceId);
    const bufferKey = this.buffering.getObservationBufferKey(lockKey);

    // Set lastBufferedBoundary IMMEDIATELY (before ANY async work) to prevent
    // shouldTriggerAsyncObservation from triggering again on the next step.
    // This MUST happen before the first await when buffer() is called fire-and-forget.
    BufferingCoordinator.lastBufferedBoundary.set(bufferKey, currentTokens);

    // Clear stale flag if it was set by a crashed process (non-blocking)
    if (record.isBufferingObservation) {
      await this.storage.setBufferingObservationFlag(record.id, false).catch(() => {});
    }

    // Wait for any existing buffering operation to complete first (mutex behavior).
    // IMPORTANT: read the existing op BEFORE overwriting the map entry.
    const existingOp = BufferingCoordinator.asyncBufferingOps.get(bufferKey);
    if (existingOp) {
      try {
        await existingOp;
      } catch {
        // Previous op failed, continue with new one
      }
    }

    // Set persistent flag and register op
    registerOp(record.id, 'bufferingObservation');
    this.storage.setBufferingObservationFlag(record.id, true, currentTokens).catch(err => {
      omError('[OM] Failed to set buffering observation flag', err);
    });

    // Register in asyncBufferingOps so callers (and tests) can await completion
    let resolveOp: () => void;
    const opPromise = new Promise<void>(resolve => {
      resolveOp = resolve;
    });
    BufferingCoordinator.asyncBufferingOps.set(bufferKey, opPromise);

    // Re-fetch record after mutex wait to get the latest state
    record = (await this.storage.getObservationalMemory(record.threadId, record.resourceId)) ?? record;

    let flagCleared = false;

    try {
      // Load messages: use provided or load from storage
      let candidateMessages: MastraDBMessage[];
      if (opts.messages) {
        candidateMessages = this.getUnobservedMessages(opts.messages, record, { excludeBuffered: true });
      } else {
        const rawMessages = await this.loadMessagesFromStorage(
          threadId,
          resourceId,
          record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
        );
        candidateMessages = this.getUnobservedMessages(rawMessages, record, { excludeBuffered: true });
      }

      // Apply cursor filtering only for storage-loaded messages.
      // When messages are provided directly, they're fresh and shouldn't be filtered by cursor.
      if (!opts.messages) {
        let bufferCursor = BufferingCoordinator.lastBufferedAtTime.get(bufferKey) ?? record.lastBufferedAtTime ?? null;
        if (record.lastObservedAt) {
          const lastObserved = new Date(record.lastObservedAt);
          if (!bufferCursor || lastObserved > bufferCursor) {
            bufferCursor = lastObserved;
          }
        }

        if (bufferCursor) {
          candidateMessages = candidateMessages.filter(msg => {
            if (!msg.createdAt) return true;
            return new Date(msg.createdAt) > bufferCursor;
          });
        }
      }

      // Check minimum token threshold
      const bufferTokens = this.observationConfig.bufferTokens ?? 5000;
      const minNewTokens = bufferTokens / 2;
      const newTokens = await this.tokenCounter.countMessagesAsync(candidateMessages);

      if (newTokens < minNewTokens || candidateMessages.length === 0) {
        return { buffered: false, record };
      }

      // Seal candidates before the observer runs.
      // If a beforeBuffer callback is provided (processor path), it handles sealing + persistence.
      // Otherwise, seal automatically so external consumers don't need to deal with it.
      if (opts.beforeBuffer) {
        await opts.beforeBuffer(candidateMessages);
      } else if (opts.messages) {
        this.sealMessagesForBuffering(candidateMessages);
      }

      // Generate cycle ID
      const cycleId = `buffer-obs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const startedAt = new Date().toISOString();

      const startMarker = createBufferingStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToBuffer: newTokens,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
        config: this.getObservationMarkerConfig(),
      });
      await this.persistMarkerToStorage(startMarker, threadId, record.resourceId ?? undefined);

      // Emit buffering start marker without letting the stream writer create a separate data-only DB message.
      const writer = opts.writer;
      if (writer) {
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        void writer.custom({ ...startMarker, transient: true }).catch(() => {});
      }

      // Call the observer via strategy pattern
      await ObservationStrategy.create(this, {
        record,
        threadId,
        resourceId: record.resourceId ?? undefined,
        messages: candidateMessages,
        cycleId,
        startedAt,
        writer,
        requestContext,
        observabilityContext,
      }).run();

      if (isOmReproCaptureEnabled()) {
        writeObserverExchangeReproCapture({
          threadId,
          resourceId: record.resourceId ?? undefined,
          label: `buffer-${cycleId}`,
          observerExchange: this.observer.lastExchange,
          details: {
            cycleId,
            startedAt,
            buffered: true,
            candidateMessageIds: candidateMessages.map(message => message.id),
            candidateMessageCount: candidateMessages.length,
            pendingTokens: currentTokens,
            newTokens,
          },
        });
      }

      // Update the boundary tokens in storage + in-memory cache for interval tracking
      await this.storage.setBufferingObservationFlag(record.id, false, newTokens).catch(() => {});
      flagCleared = true;
      BufferingCoordinator.lastBufferedBoundary.set(bufferKey, newTokens);

      // Update lastBufferedAtTime in-memory cache so subsequent buffer() calls filter correctly
      const maxTimestamp = this.getMaxMessageTimestamp(candidateMessages);
      const cursor = new Date(maxTimestamp.getTime() + 1);
      BufferingCoordinator.lastBufferedAtTime.set(bufferKey, cursor);

      const updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
      return { buffered: true, record: updatedRecord };
    } catch (error) {
      omError('[OM] buffer() failed', error);
      return { buffered: false, record };
    } finally {
      unregisterOp(record.id, 'bufferingObservation');
      BufferingCoordinator.asyncBufferingOps.delete(bufferKey);
      resolveOp!();
      // Only clear the flag if the success path didn't already clear it (with token count)
      if (!flagCleared) {
        await this.storage.setBufferingObservationFlag(record.id, false).catch(() => {});
      }
    }
  }

  /**
   * Activate buffered observation chunks by merging them into active observations.
   *
   * This is a pure storage operation — no LLM call. It reads buffered chunks from
   * the DB and swaps them into active observations via `storage.swapBufferedToActive()`.
   *
   * Call this after `buffer()` has created chunks, typically at the start of a new
   * turn or when `getStatus().canActivate` is true.
   *
   * @example
   * ```ts
   * const status = await om.getStatus({ threadId });
   * if (status.canActivate) {
   *   const result = await om.activate({ threadId });
   *   if (result.activated) {
   *     console.log('Activated', result.activatedMessageIds?.length, 'message observations');
   *   }
   * }
   * ```
   */
  /** @internal Used by ObservationStep. */
  async activate(opts: {
    threadId: string;
    resourceId?: string;
    /** When true, skip activation if pending tokens are below the observation threshold. */
    checkThreshold?: boolean;
    /** Messages to use for threshold check (in-memory). If omitted, loads from storage. */
    messages?: MastraDBMessage[];
    /** Current actor model for provider-change activation checks. */
    currentModel?: ObservationModelContext;
    /** Stream writer for emitting activation markers to the UI. */
    writer?: ProcessorStreamWriter;
    /** MessageList for persisting activation markers on the last assistant message. */
    messageList?: MessageList;
  }): Promise<{
    activated: boolean;
    record: ObservationalMemoryRecord;
    activatedMessageIds?: string[];
  }> {
    const { threadId, resourceId } = opts;

    const record = await this.getOrCreateRecord(threadId, resourceId);

    // Reset stale lastBufferedBoundary at the start of a new turn.
    // If the stored boundary is far above the current context size, it's
    // leftover from a previous turn and would block future buffering triggers.
    if (this.buffering.isAsyncObservationEnabled()) {
      const lockKey = this.buffering.getLockKey(threadId, resourceId);
      const bufKey = this.buffering.getObservationBufferKey(lockKey);
      const dbBoundary = record.lastBufferedAtTokens ?? 0;
      if (dbBoundary > 0 && opts.messages) {
        const unobserved = this.getUnobservedMessages(opts.messages, record);
        const currentContextTokens = this.tokenCounter.countMessages(unobserved);
        if (currentContextTokens < dbBoundary * 0.5) {
          omDebug(
            `[OM:activate] resetting stale lastBufferedBoundary: dbBoundary=${dbBoundary}, currentContextTokens=${currentContextTokens}`,
          );
          BufferingCoordinator.lastBufferedBoundary.set(bufKey, 0);
          await this.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});
        }
      }
    }

    // Check for buffered chunks
    const chunks = getBufferedChunks(record);
    if (!chunks.length) {
      return { activated: false, record };
    }

    let activationTriggeredBy: 'threshold' | 'ttl' | 'provider_change' = 'threshold';
    let activationLastActivityAt: number | undefined;
    let activateAfterIdleExpiredMs: number | undefined;
    let previousModel: string | undefined;
    let currentModel: string | undefined;

    // Optional threshold guard — skip activation if pending tokens are below threshold
    if (opts.checkThreshold) {
      const thresholdMessages =
        opts.messages ??
        (await this.loadMessagesFromStorage(
          threadId,
          resourceId,
          record.lastObservedAt ? new Date(record.lastObservedAt) : undefined,
        ));

      const activateAfterIdle = this.observationConfig.activateAfterIdle;
      const lastActivityAt = getLastActivityFromMessages(thresholdMessages);
      const ttlExpiredMs =
        activateAfterIdle !== undefined && lastActivityAt !== undefined ? Date.now() - lastActivityAt : undefined;
      const ttlExpired =
        ttlExpiredMs !== undefined && activateAfterIdle !== undefined && ttlExpiredMs >= activateAfterIdle;
      const actorModel = getCurrentModel(opts.currentModel);
      const lastModel = getLastModelFromMessages(thresholdMessages);
      const providerChanged =
        this.observationConfig.activateOnProviderChange === true && hasProviderChanged(actorModel, lastModel);

      if (providerChanged) {
        activationTriggeredBy = 'provider_change';
        previousModel = lastModel;
        currentModel = actorModel;
      } else if (ttlExpired) {
        activationTriggeredBy = 'ttl';
        activationLastActivityAt = lastActivityAt;
        activateAfterIdleExpiredMs = ttlExpiredMs;
      } else {
        const status = await this.getStatus({ threadId, resourceId, messages: thresholdMessages });
        if (status.pendingTokens < status.threshold) {
          return { activated: false, record };
        }
      }
    }

    // Wait for any in-progress buffering to complete (check DB flag)
    if (record.isBufferingObservation) {
      // If the op is active in this process, wait for it
      const lockKey = this.buffering.getLockKey(threadId, resourceId);
      const bufferKey = this.buffering.getObservationBufferKey(lockKey);
      const asyncOp = BufferingCoordinator.asyncBufferingOps.get(bufferKey);
      if (asyncOp) {
        try {
          await Promise.race([
            asyncOp,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60_000)),
          ]);
        } catch {
          // Timeout or error — proceed with what we have
        }
      }
      // If not in this process, the flag might be stale or from another replica.
      // Proceed with activation of whatever chunks exist.
    }

    // Re-fetch to get latest chunks after any completed buffering
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    if (!freshRecord) {
      return { activated: false, record };
    }
    const freshChunks = getBufferedChunks(freshRecord);
    if (!freshChunks.length) {
      return { activated: false, record };
    }

    // Calculate activation parameters (use per-record override if set)
    const messageTokensThreshold = getMaxThreshold(this.getEffectiveMessageTokens(freshRecord));
    const bufferActivation = this.observationConfig.bufferActivation ?? 0.7;
    const activationRatio = resolveActivationRatio(bufferActivation, messageTokensThreshold);

    // Estimate current pending tokens from chunks
    const totalChunkMessageTokens = freshChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
    const currentPendingTokens = freshRecord.pendingMessageTokens || totalChunkMessageTokens;

    const forceMaxActivation = !!(
      this.observationConfig.blockAfter && currentPendingTokens >= this.observationConfig.blockAfter
    );

    // Perform the swap
    const activationResult = await this.storage.swapBufferedToActive({
      id: freshRecord.id,
      activationRatio,
      messageTokensThreshold,
      currentPendingTokens,
      forceMaxActivation,
      bufferedChunks: freshChunks,
    });

    // Clear buffering flag
    await this.storage.setBufferingObservationFlag(freshRecord.id, false).catch(() => {});
    unregisterOp(freshRecord.id, 'bufferingObservation');

    // Fetch updated record for marker emission
    const postSwapRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    // Emit activation markers for UI feedback — one per activated cycleId
    if (opts.writer && postSwapRecord && activationResult.activatedCycleIds.length > 0) {
      const perChunkMap = new Map(activationResult.perChunk?.map(c => [c.cycleId, c]));
      for (const cycleId of activationResult.activatedCycleIds) {
        const chunkData = perChunkMap.get(cycleId);
        const activationMarker = createActivationMarker({
          cycleId,
          operationType: 'observation',
          chunksActivated: 1,
          tokensActivated: chunkData?.messageTokens ?? activationResult.messageTokensActivated,
          observationTokens: chunkData?.observationTokens ?? activationResult.observationTokensActivated,
          messagesActivated: chunkData?.messageCount ?? activationResult.messagesActivated,
          recordId: postSwapRecord.id,
          threadId: postSwapRecord.threadId ?? record.threadId ?? '',
          generationCount: postSwapRecord.generationCount ?? 0,
          observations: chunkData?.observations ?? activationResult.observations,
          triggeredBy: activationTriggeredBy,
          lastActivityAt: activationLastActivityAt,
          ttlExpiredMs: activateAfterIdleExpiredMs,
          previousModel,
          currentModel,
          config: this.getObservationMarkerConfig(),
        });
        // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
        void opts.writer.custom({ ...activationMarker, transient: true }).catch(() => {});
        await this.persistMarkerToMessage(
          activationMarker,
          opts.messageList,
          record.threadId ?? '',
          record.resourceId ?? undefined,
        );
      }
    }

    // Update thread metadata with continuation hints from activated chunks
    const thread = await this.storage.getThreadById({ threadId });
    if (thread) {
      // Get hints from the most recent activated chunk
      const activatedChunks = freshChunks.filter(c => activationResult.activatedCycleIds.includes(c.cycleId));
      const lastActivated = activatedChunks[activatedChunks.length - 1];
      if (lastActivated) {
        const chunkThreadTitle = lastActivated.threadTitle;
        const newMetadata = setThreadOMMetadata(thread.metadata, {
          suggestedResponse: lastActivated.suggestedContinuation,
          currentTask: lastActivated.currentTask,
          threadTitle: chunkThreadTitle,
        });
        const oldTitle = thread.title?.trim();
        const newTitle = chunkThreadTitle?.trim();
        const shouldUpdateThreadTitle = !!newTitle && newTitle.length >= 3 && newTitle !== oldTitle;
        await this.storage.updateThread({
          id: threadId,
          title: shouldUpdateThreadTitle ? newTitle : (thread.title ?? ''),
          metadata: newMetadata,
        });
      }
    }

    const updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
    return {
      activated: true,
      record: updatedRecord,
      activatedMessageIds: activationResult.activatedMessageIds,
    };
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
    writer?: ProcessorStreamWriter;
    observabilityContext?: ObservabilityContext;
  }): Promise<{
    observed: boolean;
    reflected: boolean;
    record: ObservationalMemoryRecord;
  }> {
    const { threadId, resourceId, messages, hooks, requestContext } = opts;
    const lockKey = this.buffering.getLockKey(threadId, resourceId);
    const reflectionHooks = hooks
      ? { onReflectionStart: hooks.onReflectionStart, onReflectionEnd: hooks.onReflectionEnd }
      : undefined;

    let observed = false;
    let observationUsage: ObserveHookUsage | undefined;
    let generationBefore = -1;

    await this.withLock(lockKey, async () => {
      const freshRecord = await this.getOrCreateRecord(threadId, resourceId);
      generationBefore = freshRecord.generationCount;

      const unobservedMessages = messages
        ? this.getUnobservedMessages(messages, freshRecord)
        : await this.loadMessagesFromStorage(
            threadId,
            resourceId,
            freshRecord.lastObservedAt ? new Date(freshRecord.lastObservedAt) : undefined,
          );

      if (
        !this.meetsObservationThreshold({
          record: freshRecord,
          unobservedTokens: await this.tokenCounter.countMessagesAsync(unobservedMessages),
        })
      ) {
        return;
      }

      hooks?.onObservationStart?.();
      let observationError: Error | undefined;
      try {
        const result = await ObservationStrategy.create(this, {
          record: freshRecord,
          threadId,
          resourceId,
          messages: unobservedMessages,
          reflectionHooks,
          requestContext,
          writer: opts.writer,
          observabilityContext: opts.observabilityContext,
        }).run();
        observed = result.observed;
        observationUsage = result.usage;
      } catch (error) {
        observationError = error instanceof Error ? error : new Error(String(error));
        throw error;
      } finally {
        hooks?.onObservationEnd?.({ usage: observationUsage, error: observationError });
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
    observabilityContext?: ObservabilityContext,
  ): Promise<{
    reflected: boolean;
    record: ObservationalMemoryRecord;
    usage?: ObserveHookUsage;
  }> {
    const record = await this.getOrCreateRecord(threadId, resourceId);

    if (!record.activeObservations) {
      return { reflected: false, record, usage: undefined };
    }

    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    try {
      const reflectThreshold = getMaxThreshold(this.getEffectiveReflectionTokens(record));
      const reflectResult = await this.reflector.call(
        record.activeObservations,
        prompt,
        undefined,
        reflectThreshold,
        undefined,
        undefined,
        undefined,
        requestContext,
        observabilityContext,
        undefined,
      );
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Note: Thread metadata (currentTask, suggestedResponse) is preserved on each thread
      // and doesn't need to be updated during reflection - it was set during observation
      const updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
      return { reflected: true, record: updatedRecord, usage: reflectResult.usage };
    } catch (error) {
      omError('[OM] reflect() failed', error);
      const latestRecord = await this.getOrCreateRecord(threadId, resourceId);
      return { reflected: false, record: latestRecord, usage: undefined };
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
   * Update per-record config overrides for observation and/or reflection thresholds.
   * The provided config is deep-merged into the record's `_overrides` key,
   * so you only need to specify the fields you want to change.
   *
   * Overrides that violate buffering invariants (e.g. messageTokens below
   * bufferTokens) are silently ignored at read time — the helpers fall back
   * to the instance-level config.
   *
   * @example
   * ```ts
   * await om.updateRecordConfig('thread-1', undefined, {
   *   observation: { messageTokens: 2000 },
   *   reflection: { observationTokens: 8000 },
   * });
   * ```
   */
  async updateRecordConfig(
    threadId: string,
    resourceId: string | undefined,
    config: Record<string, unknown>,
  ): Promise<void> {
    const ids = this.getStorageIds(threadId, resourceId);
    const record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
    if (!record) {
      throw new Error(`No observational memory record found for thread ${ids.threadId}`);
    }
    // Write under _overrides so getEffectiveMessageTokens / getEffectiveReflectionTokens
    // pick up the override values, distinct from the initial config snapshot.
    await this.storage.updateObservationalMemoryConfig({
      id: record.id,
      config: { _overrides: config },
    });
  }

  /**
   * Get observation history (previous generations)
   */
  async getHistory(
    threadId: string,
    resourceId?: string,
    limit?: number,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    const ids = this.getStorageIds(threadId, resourceId);
    return this.storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId, limit, options);
  }

  /**
   * Clear all memory for a specific thread/resource
   */
  async clear(threadId: string, resourceId?: string): Promise<void> {
    const ids = this.getStorageIds(threadId, resourceId);
    await this.storage.clearObservationalMemory(ids.threadId, ids.resourceId);
    // Clean up static maps to prevent memory leaks
    this.buffering.cleanupStaticMaps(ids.threadId ?? ids.resourceId, ids.resourceId);
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

  /**
   * Get the message history instance for marker persistence.
   */
  getMessageHistory(): MessageHistory {
    return this.messageHistory;
  }

  /**
   * Get whether thread IDs should be obscured in observations.
   */
  getObscureThreadIds(): boolean {
    return this.shouldObscureThreadIds;
  }

  /**
   * Begin a new observation turn — the high-level API for managing the
   * observe/buffer/activate/reflect lifecycle across agentic loop steps.
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
   * await turn.end();
   * ```
   */
  beginTurn(opts: {
    threadId: string;
    resourceId?: string;
    messageList: MessageList;
    observabilityContext?: ObservabilityContext;
    hooks?: ObservationTurnHooks;
  }): ObservationTurn {
    return new ObservationTurn({
      om: this,
      threadId: opts.threadId,
      resourceId: opts.resourceId,
      messageList: opts.messageList,
      observabilityContext: opts.observabilityContext,
      hooks: opts.hooks,
    });
  }
}
