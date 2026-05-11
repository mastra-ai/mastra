import type { CallSettings } from '@internal/ai-sdk-v5';

import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraServerCache } from '../../cache';
import { InMemoryServerCache } from '../../cache';
import type { ModelRouterModelId } from '../../llm/model';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraLanguageModel, OpenAICompatibleConfig } from '../../llm/model/shared.types';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type {
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputStepArgs,
  Processor,
  ProcessorViolation,
} from '../index';

/**
 * Scope determines what observability data is queried:
 * - 'run': Only data from the current agent run (trace)
 * - 'resource': Data across runs for the same resourceId (default)
 * - 'thread': Data across runs for the same threadId
 */
export type RouterScope = 'run' | 'resource' | 'thread';

/**
 * Named time windows for observability data aggregation.
 * Only applicable to 'resource' and 'thread' scopes.
 */
export type RouterWindow = '5m' | '1h' | '6h' | '24h' | '7d' | '30d' | '365d';

/**
 * A model reference that the router can switch to.
 * Supports the same types as ProcessInputStepResult.model.
 */
export type FallbackModel = MastraLanguageModel | ModelRouterModelId | OpenAICompatibleConfig;

/**
 * Per-model settings that travel with the model override when the router
 * selects a fallback. These are included alongside `model` in the
 * ProcessInputStepResult so the LLM execution step uses the correct settings.
 */
export interface FallbackModelSettings {
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  providerOptions?: ProviderOptions;
  headers?: Record<string, string>;
}

/**
 * Error-rate rule: switches model when the error rate for the current model
 * exceeds a threshold, using metric breakdown with status labels.
 */
export interface ErrorRateRule {
  signal: 'error-rate';
  /**
   * Metric name to query for error rate.
   * @default 'mastra_model_duration_ms'
   */
  metric?: string;
  /** Error rate threshold (0-1). When exceeded, the rule fires. */
  threshold: number;
  /** Minimum number of requests before the rule can fire. @default 5 */
  minRequests?: number;
  /** Time window for error rate calculation. @default '5m' */
  window?: RouterWindow;
  /** Cooldown duration before retrying the original model. @default '2m' */
  cooldown?: string;
  /** Ordered list of fallback models. First available (non-cooled-down) model is selected. */
  fallbackModels: FallbackModel[];
}

/**
 * Score rule: switches model when the aggregate score for a scorer
 * drops below a minimum threshold.
 */
export interface ScoreRule {
  signal: 'score';
  /** Scorer ID to query (e.g. 'relevance', 'accuracy'). */
  scorerId: string;
  /** Aggregation function for the score. @default 'avg' */
  aggregation?: 'avg' | 'min' | 'max';
  /** Minimum acceptable score. When the aggregate drops below this, the rule fires. */
  minScore: number;
  /** Time window for score aggregation. @default '24h' */
  window?: RouterWindow;
  /** Cooldown duration before re-checking. @default '5m' */
  cooldown?: string;
  /** Ordered list of fallback models. */
  fallbackModels: FallbackModel[];
}

/**
 * Feedback rule: switches model based on user feedback breakdown,
 * selecting the highest-rated model from a configured set.
 */
export interface FeedbackRule {
  signal: 'feedback';
  /** Feedback type to query (e.g. 'thumbs', 'rating'). */
  feedbackType: string;
  /** Strategy for selecting a model. @default 'best-rated' */
  strategy?: 'best-rated';
  /** Aggregation function for feedback values. @default 'avg' */
  aggregation?: 'avg' | 'sum';
  /** Minimum number of feedback samples before the rule can fire. @default 10 */
  minSamples?: number;
  /** Time window for feedback aggregation. @default '7d' */
  window?: RouterWindow;
  /** Models to compare feedback for. Each must have a label that matches the model dimension. */
  models: FallbackModel[];
}

export type AdaptiveModelRouterRule = ErrorRateRule | ScoreRule | FeedbackRule;

/**
 * Metadata attached when the router switches models.
 */
export interface AdaptiveModelRouterTripwireMetadata {
  processorId: 'adaptive-model-router';
  rule: AdaptiveModelRouterRule['signal'];
  originalModel: string;
  selectedModel: string;
  reason: string;
}

/**
 * Violation detail emitted via onViolation callback.
 */
export interface AdaptiveModelRouterViolationDetail {
  rule: AdaptiveModelRouterRule['signal'];
  originalModel: string;
  selectedModel: string;
  reason: string;
}

/**
 * Configuration options for AdaptiveModelRouter.
 */
export interface AdaptiveModelRouterOptions {
  /**
   * Ordered list of rules. Rules are evaluated in order; the first rule that fires wins.
   */
  rules: AdaptiveModelRouterRule[];

  /**
   * Scope for observability data queries.
   * @default 'resource'
   */
  scope?: RouterScope;

  /**
   * Time window for queries when using 'resource' or 'thread' scope.
   * Can be overridden per-rule.
   * @default '24h'
   */
  window?: RouterWindow;
}

/**
 * Options for creating an AdaptiveModelRouter from agent model fallbacks.
 * Used when `adaptiveFallbacks` is enabled on an agent with a model fallback array.
 */
export interface AdaptiveFallbacksOptions {
  /**
   * Error rate threshold (0-1). When a model's error rate exceeds this, it is skipped.
   * @default 0.3
   */
  errorRateThreshold?: number;
  /**
   * Time window for error rate calculation.
   * @default '5m'
   */
  window?: RouterWindow;
  /**
   * Cooldown duration before retrying a model that was marked as failing.
   * @default '2m'
   */
  cooldown?: string;
  /**
   * Minimum number of requests before the error rate rule can fire.
   * @default 5
   */
  minRequests?: number;
  /**
   * Scope for observability data queries.
   * @default 'resource'
   */
  scope?: RouterScope;
}

const WINDOW_MS: Record<RouterWindow, number> = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
};

const COOLDOWN_MS: Record<string, number> = {
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '2m': 2 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

function parseCooldownMs(cooldown: string): number {
  const mapped = COOLDOWN_MS[cooldown];
  if (mapped !== undefined) return mapped;

  const match = cooldown.match(/^(\d+)(s|m|h)$/);
  if (!match) {
    throw new Error(`AdaptiveModelRouter: invalid cooldown format '${cooldown}'. Use e.g. '30s', '2m', '1h'.`);
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

function getModelId(model: FallbackModel): string {
  if (typeof model === 'string') return model;
  if ('modelId' in model && typeof model.modelId === 'string') {
    if ('providerId' in model && typeof model.providerId === 'string') {
      return `${model.providerId}/${model.modelId}`;
    }
    if ('provider' in model && typeof model.provider === 'string') {
      return `${model.provider}/${model.modelId}`;
    }
    return model.modelId;
  }
  if ('id' in model && typeof model.id === 'string') {
    return model.id;
  }
  return 'unknown';
}

/**
 * AdaptiveModelRouter intelligently switches models based on observability signals.
 *
 * Combines circuit-breaker (error-rate), score-gating, and feedback-routing
 * into a single processor with prioritized rules. Uses cache (Redis or in-memory)
 * to persist cooldown state across requests in serverless environments.
 *
 * **Chained fallbacks**: Each rule can specify multiple fallback models. When the
 * primary model's circuit is open, the router tries fallbacks in order, skipping
 * any that are also in cooldown. This enables fallback-of-fallback patterns.
 *
 * Uses `processInputStep` to evaluate rules before each LLM call.
 *
 * @example Error-rate circuit breaker with chained fallbacks:
 * ```typescript
 * new AdaptiveModelRouter({
 *   rules: [{
 *     signal: 'error-rate',
 *     threshold: 0.3,
 *     window: '5m',
 *     cooldown: '2m',
 *     fallbackModels: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku'],
 *   }],
 * })
 * ```
 *
 * @example Score-gated quality enforcement:
 * ```typescript
 * new AdaptiveModelRouter({
 *   rules: [{
 *     signal: 'score',
 *     scorerId: 'relevance',
 *     minScore: 0.7,
 *     window: '24h',
 *     fallbackModels: ['openai/gpt-4o'],
 *   }],
 * })
 * ```
 *
 * @example Combined rules (first matching rule wins):
 * ```typescript
 * new AdaptiveModelRouter({
 *   rules: [
 *     { signal: 'error-rate', threshold: 0.3, cooldown: '2m', fallbackModels: ['openai/gpt-4o-mini'] },
 *     { signal: 'score', scorerId: 'relevance', minScore: 0.7, fallbackModels: ['openai/gpt-4o'] },
 *     { signal: 'feedback', feedbackType: 'thumbs', models: ['openai/gpt-4o', 'anthropic/claude-3-sonnet'] },
 *   ],
 * })
 * ```
 */
export class AdaptiveModelRouter implements Processor<'adaptive-model-router', AdaptiveModelRouterTripwireMetadata> {
  public readonly id = 'adaptive-model-router';
  public readonly name = 'Adaptive Model Router';

  private rules: AdaptiveModelRouterRule[];
  private scope: RouterScope;
  private defaultWindow: RouterWindow;
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;

  private observabilityStorage?: ObservabilityStorage;
  private cache?: MastraServerCache;

  /**
   * All model IDs from the original fallback array (set when created via fromModelFallbacks).
   * Used to track cooldown per-model in the fallback chain so that when processInputStep
   * receives any model in the chain, the router can skip it if it's in cooldown and
   * jump to the next available model.
   */
  private fallbackChainModelIds?: string[];

  /**
   * Per-model settings lookup keyed by model ID (set when created via fromModelFallbacks).
   * When the router switches to a fallback, these settings (modelSettings, providerOptions,
   * headers) are included in the ProcessInputStepResult alongside the model override.
   */
  private fallbackSettingsMap?: Map<string, FallbackModelSettings>;

  /**
   * Creates an AdaptiveModelRouter from an agent's model fallback array.
   *
   * When an agent has `model: [modelA, modelB, modelC]`, this factory creates a router
   * that monitors error rates for each model in the chain. Instead of always trying
   * model A first (even if it has been failing), the router skips models in cooldown
   * and jumps directly to the next healthy model.
   *
   * This is the mechanism behind the `adaptiveFallbacks` agent config option.
   *
   * @example
   * ```typescript
   * // Automatic (via agent config):
   * const agent = new Agent({
   *   model: [
   *     { model: 'openai/gpt-4o' },
   *     { model: 'anthropic/claude-3.5-sonnet' },
   *     { model: 'openai/gpt-4o-mini' },
   *   ],
   *   adaptiveFallbacks: true,
   * });
   *
   * // Manual:
   * const router = AdaptiveModelRouter.fromModelFallbacks(
   *   [
   *     { id: 'primary', model: 'openai/gpt-4o' },
   *     { id: 'fallback-1', model: 'anthropic/claude-3.5-sonnet' },
   *     { id: 'fallback-2', model: 'openai/gpt-4o-mini' },
   *   ],
   *   { errorRateThreshold: 0.3, window: '5m', cooldown: '2m' },
   * );
   * ```
   */
  static fromModelFallbacks(
    fallbacks: Array<{
      id: string;
      model: FallbackModel;
      enabled?: boolean;
      modelSettings?: FallbackModelSettings['modelSettings'];
      providerOptions?: FallbackModelSettings['providerOptions'];
      headers?: FallbackModelSettings['headers'];
    }>,
    options?: AdaptiveFallbacksOptions,
  ): AdaptiveModelRouter {
    const enabledFallbacks = fallbacks.filter(f => f.enabled !== false);
    if (enabledFallbacks.length < 2) {
      throw new Error('AdaptiveModelRouter.fromModelFallbacks requires at least 2 enabled models');
    }

    const threshold = options?.errorRateThreshold ?? 0.3;
    const window = options?.window ?? '5m';
    const cooldown = options?.cooldown ?? '2m';
    const minRequests = options?.minRequests ?? 5;
    const scope = options?.scope ?? 'resource';

    const allModels = enabledFallbacks.map(f => f.model);

    const rule: ErrorRateRule = {
      signal: 'error-rate',
      threshold,
      window,
      cooldown,
      minRequests,
      fallbackModels: allModels.slice(1),
    };

    const router = new AdaptiveModelRouter({
      rules: [rule],
      scope,
      window,
    });

    // Store the full chain so processInputStep can handle any model in the chain
    router.fallbackChainModelIds = allModels.map(m => getModelId(m));

    // Build per-model settings map so the router can include modelSettings,
    // providerOptions, and headers in the ProcessInputStepResult when switching
    const settingsMap = new Map<string, FallbackModelSettings>();
    for (const entry of enabledFallbacks) {
      const modelId = getModelId(entry.model);
      const settings: FallbackModelSettings = {};
      if (entry.modelSettings) settings.modelSettings = entry.modelSettings;
      if (entry.providerOptions) settings.providerOptions = entry.providerOptions;
      if (entry.headers) settings.headers = entry.headers;
      if (Object.keys(settings).length > 0) {
        settingsMap.set(modelId, settings);
      }
    }
    if (settingsMap.size > 0) {
      router.fallbackSettingsMap = settingsMap;
    }

    return router;
  }

  constructor(options: AdaptiveModelRouterOptions) {
    if (!options.rules || options.rules.length === 0) {
      throw new Error('AdaptiveModelRouter requires at least one rule');
    }

    for (const rule of options.rules) {
      if (rule.signal === 'error-rate') {
        if (rule.threshold <= 0 || rule.threshold > 1) {
          throw new Error('Error-rate rule threshold must be between 0 (exclusive) and 1 (inclusive)');
        }
        if (!rule.fallbackModels || rule.fallbackModels.length === 0) {
          throw new Error('Error-rate rule requires at least one fallback model');
        }
      } else if (rule.signal === 'score') {
        if (!rule.scorerId) {
          throw new Error('Score rule requires a scorerId');
        }
        if (!rule.fallbackModels || rule.fallbackModels.length === 0) {
          throw new Error('Score rule requires at least one fallback model');
        }
      } else if (rule.signal === 'feedback') {
        if (!rule.feedbackType) {
          throw new Error('Feedback rule requires a feedbackType');
        }
        if (!rule.models || rule.models.length < 2) {
          throw new Error('Feedback rule requires at least two models to compare');
        }
      }
    }

    this.rules = options.rules;
    this.scope = options.scope ?? 'resource';
    this.defaultWindow = options.window ?? '24h';
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    const storage = mastra.getStorage();
    const obsStorage = storage?.stores?.observability;
    if (!obsStorage) {
      throw new Error(
        'AdaptiveModelRouter requires observability storage. Configure observability storage on your Mastra instance.',
      );
    }
    this.observabilityStorage = obsStorage;

    try {
      this.cache = mastra.getServerCache();
    } catch {
      this.cache = new InMemoryServerCache();
    }
  }

  private resolveScopeFilter(
    requestContext?: RequestContext,
    traceId?: string,
  ): { filter: Record<string, string>; scopeKey?: string } | undefined {
    if (this.scope === 'run') {
      if (!traceId) return undefined;
      return { filter: { traceId } };
    }
    if (this.scope === 'resource') {
      const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
      if (!resourceId) return undefined;
      return { filter: { resourceId }, scopeKey: `resource:${resourceId}` };
    }
    if (this.scope === 'thread') {
      const threadId = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
      if (!threadId) return undefined;
      return { filter: { threadId }, scopeKey: `thread:${threadId}` };
    }
    return undefined;
  }

  private getWindowTimestamp(window: RouterWindow): { start: Date } {
    const windowMs = WINDOW_MS[window];
    return { start: new Date(Date.now() - windowMs) };
  }

  private getCooldownKey(modelId: string, scopeKey?: string): string {
    const scope = scopeKey ?? 'global';
    return `adaptive-router:circuit-breaker:${modelId}:${scope}`;
  }

  private async isModelInCooldown(modelId: string, cooldownMs: number, scopeKey?: string): Promise<boolean> {
    if (!this.cache) return false;
    try {
      const key = this.getCooldownKey(modelId, scopeKey);
      const value = await this.cache.get(key);
      if (value === null || value === undefined) return false;
      const openedAt = typeof value === 'number' ? value : Number(value);
      if (isNaN(openedAt)) return false;
      return Date.now() < openedAt + cooldownMs;
    } catch {
      return false;
    }
  }

  private async openCircuit(modelId: string, scopeKey?: string): Promise<void> {
    if (!this.cache) return;
    try {
      const key = this.getCooldownKey(modelId, scopeKey);
      await this.cache.set(key, Date.now());
    } catch {
      // Cache errors should not prevent the router from functioning
    }
  }

  /**
   * Builds a ProcessInputStepResult for a selected fallback model,
   * including any per-model settings (modelSettings, providerOptions, headers)
   * that were configured in the original fallback array.
   */
  private buildFallbackResult(fallbackModel: FallbackModel): ProcessInputStepResult {
    const result: ProcessInputStepResult = { model: fallbackModel };
    if (this.fallbackSettingsMap) {
      const modelId = getModelId(fallbackModel);
      const settings = this.fallbackSettingsMap.get(modelId);
      if (settings) {
        if (settings.modelSettings) result.modelSettings = settings.modelSettings;
        if (settings.providerOptions) result.providerOptions = settings.providerOptions;
      }
    }
    return result;
  }

  /**
   * Find the first available fallback model that is not in cooldown.
   * Implements the chained fallback pattern: if fallback A is also in cooldown,
   * try fallback B, and so on.
   */
  private async findAvailableFallback(
    fallbackModels: FallbackModel[],
    cooldownMs: number,
    scopeKey?: string,
  ): Promise<FallbackModel | undefined> {
    for (const model of fallbackModels) {
      const modelId = getModelId(model);
      const inCooldown = await this.isModelInCooldown(modelId, cooldownMs, scopeKey);
      if (!inCooldown) {
        return model;
      }
    }
    return undefined;
  }

  private async evaluateErrorRateRule(
    rule: ErrorRateRule,
    currentModelId: string,
    scopeFilter: Record<string, string>,
    scopeKey?: string,
  ): Promise<ProcessInputStepResult | undefined> {
    if (!this.observabilityStorage) return undefined;

    const cooldownStr = rule.cooldown ?? '2m';
    const cooldownMs = parseCooldownMs(cooldownStr);

    // Check if current model is already in cooldown
    if (await this.isModelInCooldown(currentModelId, cooldownMs, scopeKey)) {
      const fallback = await this.findAvailableFallback(rule.fallbackModels, cooldownMs, scopeKey);
      if (fallback) {
        const selectedId = getModelId(fallback);
        await this.notifyViolation('error-rate', currentModelId, selectedId, 'Model in cooldown (circuit open)');
        return this.buildFallbackResult(fallback);
      }
      // All fallbacks also in cooldown — stay with current model
      return undefined;
    }

    const window = rule.window ?? '5m';
    const metric = rule.metric ?? 'mastra_model_duration_ms';
    const minRequests = rule.minRequests ?? 5;

    try {
      const filters: Record<string, unknown> = {
        ...scopeFilter,
        entityType: 'agent',
      };
      if (this.scope !== 'run') {
        filters['timestamp'] = this.getWindowTimestamp(window as RouterWindow);
      }

      // Get breakdown by status label to compute error rate
      const breakdown = await this.observabilityStorage.getMetricBreakdown({
        name: [metric],
        groupBy: ['labels.status'],
        aggregation: 'count',
        filters,
      });

      let totalCount = 0;
      let errorCount = 0;
      for (const group of breakdown.groups) {
        const count = group.value ?? 0;
        totalCount += count;
        const status = group.dimensions['labels.status'];
        if (status === 'error' || status === 'failed') {
          errorCount += count;
        }
      }

      if (totalCount < minRequests) return undefined;

      const errorRate = errorCount / totalCount;
      if (errorRate <= rule.threshold) return undefined;

      // Error rate exceeded — open circuit and find fallback
      await this.openCircuit(currentModelId, scopeKey);
      const fallback = await this.findAvailableFallback(rule.fallbackModels, cooldownMs, scopeKey);
      if (fallback) {
        const selectedId = getModelId(fallback);
        const reason = `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(rule.threshold * 100).toFixed(1)}%`;
        await this.notifyViolation('error-rate', currentModelId, selectedId, reason);
        return this.buildFallbackResult(fallback);
      }
    } catch {
      // Query errors should not prevent the agent from running
    }

    return undefined;
  }

  private async evaluateScoreRule(
    rule: ScoreRule,
    currentModelId: string,
    scopeFilter: Record<string, string>,
    scopeKey?: string,
  ): Promise<ProcessInputStepResult | undefined> {
    if (!this.observabilityStorage) return undefined;

    const cooldownStr = rule.cooldown ?? '5m';
    const cooldownMs = parseCooldownMs(cooldownStr);
    const cooldownKey = `score:${rule.scorerId}:${currentModelId}`;

    // Check cooldown for this score rule
    if (await this.isModelInCooldown(cooldownKey, cooldownMs, scopeKey)) {
      const fallback = await this.findAvailableFallback(rule.fallbackModels, cooldownMs, scopeKey);
      if (fallback) {
        const selectedId = getModelId(fallback);
        await this.notifyViolation(
          'score',
          currentModelId,
          selectedId,
          `Score rule for '${rule.scorerId}' in cooldown`,
        );
        return this.buildFallbackResult(fallback);
      }
      return undefined;
    }

    const window = rule.window ?? '24h';
    const aggregation = rule.aggregation ?? 'avg';

    try {
      const filters: Record<string, unknown> = {
        ...scopeFilter,
      };
      if (this.scope !== 'run') {
        filters['timestamp'] = this.getWindowTimestamp(window as RouterWindow);
      }

      const result = await this.observabilityStorage.getScoreAggregate({
        scorerId: rule.scorerId,
        aggregation,
        filters,
      });

      if (result.value === null || result.value === undefined) return undefined;
      if (result.value >= rule.minScore) return undefined;

      // Score below minimum — open circuit and find fallback
      await this.openCircuit(cooldownKey, scopeKey);
      const fallback = await this.findAvailableFallback(rule.fallbackModels, cooldownMs, scopeKey);
      if (fallback) {
        const selectedId = getModelId(fallback);
        const reason = `Score '${rule.scorerId}' ${result.value.toFixed(2)} below minimum ${rule.minScore}`;
        await this.notifyViolation('score', currentModelId, selectedId, reason);
        return this.buildFallbackResult(fallback);
      }
    } catch {
      // Query errors should not prevent the agent from running
    }

    return undefined;
  }

  private async evaluateFeedbackRule(
    rule: FeedbackRule,
    currentModelId: string,
    scopeFilter: Record<string, string>,
  ): Promise<ProcessInputStepResult | undefined> {
    if (!this.observabilityStorage) return undefined;

    const window = rule.window ?? '7d';
    const aggregation = rule.aggregation ?? 'avg';
    const minSamples = rule.minSamples ?? 10;

    try {
      const filters: Record<string, unknown> = {
        ...scopeFilter,
      };
      if (this.scope !== 'run') {
        filters['timestamp'] = this.getWindowTimestamp(window as RouterWindow);
      }

      const breakdown = await this.observabilityStorage.getFeedbackBreakdown({
        feedbackType: rule.feedbackType,
        groupBy: ['entityName'],
        aggregation,
        filters,
      });

      if (breakdown.groups.length === 0) return undefined;

      // Build a map of model → score from the breakdown
      const modelScores = new Map<string, number>();
      const modelMap = new Map<string, FallbackModel>();
      for (const model of rule.models) {
        const id = getModelId(model);
        modelMap.set(id, model);
      }

      let totalSamples = 0;
      for (const group of breakdown.groups) {
        const entityName = group.dimensions['entityName'];
        if (entityName && modelMap.has(entityName)) {
          modelScores.set(entityName, group.value ?? 0);
          totalSamples++;
        }
      }

      if (totalSamples < minSamples) return undefined;

      // Find the best-rated model
      let bestModel: FallbackModel | undefined;
      let bestScore = -Infinity;
      let bestId = '';
      for (const [id, score] of modelScores) {
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
          bestModel = modelMap.get(id);
        }
      }

      // Only switch if the best model is different from the current one
      if (bestModel && bestId !== currentModelId) {
        const reason = `Feedback '${rule.feedbackType}' favors '${bestId}' (score: ${bestScore.toFixed(2)})`;
        await this.notifyViolation('feedback', currentModelId, bestId, reason);
        return this.buildFallbackResult(bestModel);
      }
    } catch {
      // Query errors should not prevent the agent from running
    }

    return undefined;
  }

  private async notifyViolation(
    rule: AdaptiveModelRouterRule['signal'],
    originalModel: string,
    selectedModel: string,
    reason: string,
  ): Promise<void> {
    if (!this.onViolation) return;
    try {
      await this.onViolation({
        processorId: this.id,
        message: `AdaptiveModelRouter: ${reason}. Switching from '${originalModel}' to '${selectedModel}'.`,
        detail: {
          rule,
          originalModel,
          selectedModel,
          reason,
        },
      });
    } catch {
      // onViolation errors should not prevent the router from functioning
    }
  }

  /**
   * In model-fallback-chain mode (created via fromModelFallbacks), finds the
   * next available model after the current one in the chain, skipping any
   * that are in cooldown. This allows the router to jump ahead in the
   * fallback chain instead of always trying models sequentially.
   */
  private async findNextAvailableInChain(
    currentModelId: string,
    rule: ErrorRateRule,
    scopeKey?: string,
  ): Promise<FallbackModel | undefined> {
    if (!this.fallbackChainModelIds) return undefined;

    const cooldownMs = parseCooldownMs(rule.cooldown ?? '2m');
    const currentIndex = this.fallbackChainModelIds.indexOf(currentModelId);

    // If the current model isn't in the chain (shouldn't happen), fall through
    if (currentIndex === -1) return undefined;

    // Look for the first model AFTER current that isn't in cooldown
    const allFallbackModels = this.rules[0]?.signal === 'error-rate' ? this.rules[0].fallbackModels : [];

    for (let i = currentIndex + 1; i < this.fallbackChainModelIds.length; i++) {
      const candidateId = this.fallbackChainModelIds[i]!;
      const inCooldown = await this.isModelInCooldown(candidateId, cooldownMs, scopeKey);
      if (!inCooldown) {
        // Return the matching FallbackModel from the rule's fallbackModels
        // Index in fallbackModels is (i - 1) because fallbackModels doesn't include the primary
        const fallbackIndex = i - 1;
        if (fallbackIndex >= 0 && fallbackIndex < allFallbackModels.length) {
          return allFallbackModels[fallbackIndex];
        }
      }
    }

    // Also check models before current (wrap around) — in case earlier models recovered
    for (let i = 0; i < currentIndex; i++) {
      const candidateId = this.fallbackChainModelIds[i]!;
      const inCooldown = await this.isModelInCooldown(candidateId, cooldownMs, scopeKey);
      if (!inCooldown) {
        if (i === 0) {
          // Primary model recovered — but we're already in the fallback chain,
          // so the LLM execution step will try it naturally. Don't override.
          return undefined;
        }
        const fallbackIndex = i - 1;
        if (fallbackIndex >= 0 && fallbackIndex < allFallbackModels.length) {
          return allFallbackModels[fallbackIndex];
        }
      }
    }

    return undefined;
  }

  async processInputStep(
    args: ProcessInputStepArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<ProcessInputStepResult | undefined> {
    const traceId = args.tracing?.currentSpan?.traceId;
    const resolved = this.resolveScopeFilter(args.requestContext, traceId);
    if (!resolved) return undefined;

    const { filter, scopeKey } = resolved;
    const currentModelId =
      typeof args.model === 'string' ? args.model : 'modelId' in args.model ? getModelId(args.model) : 'unknown';

    // Track the current model and scope key in processor state so processAPIError
    // and processOutputStep know which model was used for this step.
    args.state.__adaptiveRouter_currentModelId = currentModelId;
    args.state.__adaptiveRouter_scopeKey = scopeKey;

    // Model-fallback-chain mode: check if the current model is in cooldown
    // and skip ahead in the chain. This is the key behavior that makes
    // agent model fallbacks "smart" — instead of always trying A → fail → B → fail → C,
    // if A is known to be failing, jump directly to B or C.
    if (this.fallbackChainModelIds && this.rules.length === 1 && this.rules[0]!.signal === 'error-rate') {
      const rule = this.rules[0] as ErrorRateRule;
      const cooldownMs = parseCooldownMs(rule.cooldown ?? '2m');

      // If the current model is in cooldown, skip to the next available model
      if (await this.isModelInCooldown(currentModelId, cooldownMs, scopeKey)) {
        const nextModel = await this.findNextAvailableInChain(currentModelId, rule, scopeKey);
        if (nextModel) {
          const selectedId = getModelId(nextModel);
          await this.notifyViolation(
            'error-rate',
            currentModelId,
            selectedId,
            'Model in cooldown (skipping in fallback chain)',
          );
          // Update state to reflect the model we actually selected
          args.state.__adaptiveRouter_currentModelId = selectedId;
          return this.buildFallbackResult(nextModel);
        }
        // All models in cooldown — let the normal chain proceed
        return undefined;
      }

      // Current model is NOT in cooldown — check its error rate
      // and open the circuit if it exceeds the threshold
      const result = await this.evaluateErrorRateRule(rule, currentModelId, filter, scopeKey);
      if (result?.model) {
        args.state.__adaptiveRouter_currentModelId =
          typeof result.model === 'string'
            ? result.model
            : 'modelId' in result.model
              ? getModelId(result.model as FallbackModel)
              : currentModelId;
      }
      return result;
    }

    // Standard mode: evaluate rules in priority order — first rule that fires wins
    for (const rule of this.rules) {
      let result: ProcessInputStepResult | undefined;

      if (rule.signal === 'error-rate') {
        result = await this.evaluateErrorRateRule(rule, currentModelId, filter, scopeKey);
      } else if (rule.signal === 'score') {
        result = await this.evaluateScoreRule(rule, currentModelId, filter, scopeKey);
      } else if (rule.signal === 'feedback') {
        result = await this.evaluateFeedbackRule(rule, currentModelId, filter);
      }

      if (result) {
        if (result.model) {
          args.state.__adaptiveRouter_currentModelId =
            typeof result.model === 'string'
              ? result.model
              : 'modelId' in result.model
                ? getModelId(result.model as FallbackModel)
                : currentModelId;
        }
        return result;
      }
    }

    return undefined;
  }

  /**
   * Reactive error handling: when an LLM call fails, open the circuit for the
   * failed model and signal a retry. On retry, processInputStep will see the
   * model in cooldown and switch to the next fallback in the chain.
   *
   * This provides backwards compatibility with the existing model fallback
   * behavior — even without observability data, the router can react to
   * real-time failures and route to healthy models.
   */
  async processAPIError(
    args: ProcessAPIErrorArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<ProcessAPIErrorResult | void> {
    // Only applies in model-fallback-chain mode
    if (!this.fallbackChainModelIds) return undefined;

    const failedModelId = args.state.__adaptiveRouter_currentModelId as string | undefined;
    const scopeKey = args.state.__adaptiveRouter_scopeKey as string | undefined;
    if (!failedModelId || !scopeKey) return undefined;

    // Don't retry if we've exhausted fallbacks (tracked in state)
    const retriedModels = (args.state.__adaptiveRouter_retriedModels as string[] | undefined) ?? [];
    const allRetried = this.fallbackChainModelIds.every(id => id === failedModelId || retriedModels.includes(id));
    if (allRetried) return undefined;

    // Open the circuit for the failed model so processInputStep skips it on retry
    try {
      await this.openCircuit(failedModelId, scopeKey);
    } catch {
      // Cache errors should not prevent the retry from proceeding
    }

    // Track which models have been retried to avoid infinite loops
    retriedModels.push(failedModelId);
    args.state.__adaptiveRouter_retriedModels = retriedModels;

    await this.notifyViolation(
      'error-rate',
      failedModelId,
      'pending',
      `API error on '${failedModelId}': ${args.error instanceof Error ? args.error.message : String(args.error)}`,
    );

    return { retry: true };
  }

  /**
   * Post-response monitoring: after a successful LLM response, check for soft
   * failures (e.g., error finish reason, empty responses) and open the circuit
   * so future requests route away from a degraded model.
   *
   * Unlike processAPIError, this does NOT trigger a retry for the current
   * request (the response was already returned). Instead it proactively
   * protects subsequent requests.
   */
  /**
   * Post-response monitoring: after a successful LLM response, check for soft
   * failures (e.g., error finish reason, empty responses) and open the circuit
   * so future requests route away from a degraded model.
   *
   * Unlike processAPIError, this does NOT trigger a retry for the current
   * request (the response was already returned). Instead it proactively
   * protects subsequent requests.
   *
   * Returns the messageList unchanged — this hook is purely for side-effects
   * (opening circuits in the cache).
   */
  async processOutputStep(
    args: ProcessOutputStepArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<MastraDBMessage[]> {
    // Only applies in model-fallback-chain mode
    if (!this.fallbackChainModelIds) return args.messages;

    const currentModelId = args.state.__adaptiveRouter_currentModelId as string | undefined;
    const scopeKey = args.state.__adaptiveRouter_scopeKey as string | undefined;
    if (!currentModelId || !scopeKey) return args.messages;

    // Check for soft failures that indicate a degraded model
    const isSoftFailure =
      args.finishReason === 'error' ||
      args.finishReason === 'unknown' ||
      (args.finishReason === 'stop' && !args.text && (!args.toolCalls || args.toolCalls.length === 0));

    if (!isSoftFailure) return args.messages;

    try {
      await this.openCircuit(currentModelId, scopeKey);
      await this.notifyViolation(
        'error-rate',
        currentModelId,
        'none',
        `Soft failure detected on '${currentModelId}': finishReason='${args.finishReason}', empty=${!args.text}`,
      );
    } catch {
      // Cache errors should not affect the response
    }

    return args.messages;
  }
}
