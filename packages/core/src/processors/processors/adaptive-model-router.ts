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
 * A model entry in the AdaptiveModelRouter's fallback chain.
 * Maps 1:1 to entries in an agent's ModelFallbacks config.
 */
export interface AdaptiveModelRouterModel {
  id: string;
  model: FallbackModel;
  modelSettings?: FallbackModelSettings['modelSettings'];
  providerOptions?: FallbackModelSettings['providerOptions'];
  headers?: FallbackModelSettings['headers'];
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
  /**
   * Custom fallback order for this rule as an array of model IDs.
   * When omitted, falls back to the default order from the `models` array.
   * IDs must reference models defined in the `models` config.
   */
  fallbackOrder?: string[];
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
  /**
   * Custom fallback order for this rule as an array of model IDs.
   * When omitted, falls back to the default order from the `models` array.
   * IDs must reference models defined in the `models` config.
   */
  fallbackOrder?: string[];
}

/**
 * Feedback rule: switches model based on user feedback breakdown,
 * selecting the highest-rated model from the router's models array.
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
  /**
   * Custom fallback order for this rule as an array of model IDs.
   * When omitted, falls back to the default order from the `models` array.
   * For feedback rules with strategy 'best-rated', this is only used as the
   * candidate set -- the best-rated model among these is still selected.
   */
  fallbackOrder?: string[];
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
 *
 * The `models` array maps 1:1 to an agent's ModelFallbacks config.
 * Each entry carries its own id, model, headers, modelSettings, and providerOptions.
 * When the router switches models, these per-model settings are included in the result.
 *
 * Rules are optional -- when omitted, a default error-rate rule is created automatically.
 */
export interface AdaptiveModelRouterOptions {
  /**
   * Ordered list of models in the fallback chain.
   * First entry is the primary model; subsequent entries are fallbacks in priority order.
   * Requires at least 2 models.
   */
  models: AdaptiveModelRouterModel[];

  /**
   * Observability rules evaluated in order; the first rule that fires wins.
   * When omitted, a default error-rate rule is created using the options below.
   */
  rules?: AdaptiveModelRouterRule[];

  /**
   * Scope for observability data queries.
   * @default 'resource'
   */
  scope?: RouterScope;

  /**
   * Default time window for queries when using 'resource' or 'thread' scope.
   * Can be overridden per-rule.
   * @default '24h'
   */
  window?: RouterWindow;

  /**
   * Default cooldown duration for the circuit breaker.
   * Used by processAPIError and the top-level cooldown check in processInputStep.
   * @default '2m'
   */
  cooldown?: string;

  /**
   * Error rate threshold for the default error-rate rule (when rules are not specified).
   * @default 0.3
   */
  errorRateThreshold?: number;

  /**
   * Minimum requests before the default error-rate rule fires (when rules are not specified).
   * @default 5
   */
  minRequests?: number;
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
 * Takes a `models` array that maps 1:1 to an agent's ModelFallbacks config.
 * Each model entry carries its own id, model reference, headers, modelSettings,
 * and providerOptions. The router replaces the model fallback code path entirely.
 *
 * Combines circuit-breaker (error-rate), score-gating, and feedback-routing
 * into a single processor with prioritized rules. Uses cache (Redis or in-memory)
 * to persist cooldown state across requests in serverless environments.
 *
 * Lifecycle hooks:
 * - processInputStep: Proactive -- checks cooldowns and evaluates observability rules
 *   before each LLM call to select the best model.
 * - processAPIError: Reactive -- on API failure, opens circuit for the failed model
 *   and signals retry so processInputStep switches to the next fallback.
 * - processOutputStep: Monitors -- detects soft failures (empty responses, error
 *   finish reasons) and opens circuits for future requests.
 */
export class AdaptiveModelRouter implements Processor<'adaptive-model-router', AdaptiveModelRouterTripwireMetadata> {
  public readonly id = 'adaptive-model-router';
  public readonly name = 'Adaptive Model Router';

  private models: AdaptiveModelRouterModel[];
  private modelIds: string[];
  private rules: AdaptiveModelRouterRule[];
  private scope: RouterScope;
  private defaultWindow: RouterWindow;
  private defaultCooldownMs: number;
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;

  private observabilityStorage?: ObservabilityStorage;
  private cache?: MastraServerCache;

  constructor(options: AdaptiveModelRouterOptions) {
    if (!options.models || options.models.length < 2) {
      throw new Error('AdaptiveModelRouter requires at least 2 models');
    }

    this.models = options.models;
    this.modelIds = options.models.map(m => getModelId(m.model));
    this.scope = options.scope ?? 'resource';
    this.defaultWindow = options.window ?? '24h';
    this.defaultCooldownMs = parseCooldownMs(options.cooldown ?? '2m');

    if (options.rules && options.rules.length > 0) {
      for (const rule of options.rules) {
        if (rule.signal === 'error-rate') {
          if (rule.threshold <= 0 || rule.threshold > 1) {
            throw new Error('Error-rate rule threshold must be between 0 (exclusive) and 1 (inclusive)');
          }
        } else if (rule.signal === 'score') {
          if (!rule.scorerId) {
            throw new Error('Score rule requires a scorerId');
          }
        } else if (rule.signal === 'feedback') {
          if (!rule.feedbackType) {
            throw new Error('Feedback rule requires a feedbackType');
          }
        }
        // Validate fallbackOrder references existing model IDs
        if (rule.fallbackOrder) {
          for (const id of rule.fallbackOrder) {
            if (!this.modelIds.includes(id)) {
              throw new Error(
                `Rule fallbackOrder references unknown model '${id}'. Available models: ${this.modelIds.join(', ')}`,
              );
            }
          }
        }
      }
      this.rules = options.rules;
    } else {
      this.rules = [
        {
          signal: 'error-rate',
          threshold: options.errorRateThreshold ?? 0.3,
          window: options.window ?? '5m',
          cooldown: options.cooldown ?? '2m',
          minRequests: options.minRequests ?? 5,
        },
      ];
    }
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

  private buildFallbackResult(entry: AdaptiveModelRouterModel): ProcessInputStepResult {
    const result: ProcessInputStepResult = { model: entry.model };
    // Merge per-model headers into modelSettings so the LLM execution step
    // applies them via currentStep.modelSettings.headers.
    if (entry.modelSettings || entry.headers) {
      const settings: Record<string, unknown> = { ...(entry.modelSettings ?? {}) };
      if (entry.headers) {
        settings.headers = { ...entry.headers, ...((settings.headers as Record<string, string>) ?? {}) };
      }
      result.modelSettings = settings as ProcessInputStepResult['modelSettings'];
    }
    if (entry.providerOptions) result.providerOptions = entry.providerOptions;
    return result;
  }

  /**
   * Find the first available model that is not the current model and is not
   * in cooldown. When `fallbackOrder` is provided, only those model IDs are
   * considered and in that order. Otherwise the default `models` array order
   * is used.
   */
  private async findAvailableFallback(
    currentModelId: string,
    cooldownMs: number,
    scopeKey?: string,
    fallbackOrder?: string[],
  ): Promise<AdaptiveModelRouterModel | undefined> {
    if (fallbackOrder) {
      const modelMap = new Map(this.models.map(m => [getModelId(m.model), m]));
      for (const id of fallbackOrder) {
        if (id === currentModelId) continue;
        const entry = modelMap.get(id);
        if (!entry) continue;
        const inCooldown = await this.isModelInCooldown(id, cooldownMs, scopeKey);
        if (!inCooldown) return entry;
      }
      return undefined;
    }
    for (const entry of this.models) {
      const id = getModelId(entry.model);
      if (id === currentModelId) continue;
      const inCooldown = await this.isModelInCooldown(id, cooldownMs, scopeKey);
      if (!inCooldown) return entry;
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
      const fallback = await this.findAvailableFallback(currentModelId, cooldownMs, scopeKey, rule.fallbackOrder);
      if (fallback) {
        const selectedId = getModelId(fallback.model);
        await this.notifyViolation('error-rate', currentModelId, selectedId, 'Model in cooldown (circuit open)');
        return this.buildFallbackResult(fallback);
      }
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

      // Error rate exceeded -- open circuit and find fallback
      await this.openCircuit(currentModelId, scopeKey);
      const fallback = await this.findAvailableFallback(currentModelId, cooldownMs, scopeKey, rule.fallbackOrder);
      if (fallback) {
        const selectedId = getModelId(fallback.model);
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
      const fallback = await this.findAvailableFallback(currentModelId, cooldownMs, scopeKey, rule.fallbackOrder);
      if (fallback) {
        const selectedId = getModelId(fallback.model);
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

      // Score below minimum -- open circuit and find fallback
      await this.openCircuit(cooldownKey, scopeKey);
      const fallback = await this.findAvailableFallback(currentModelId, cooldownMs, scopeKey, rule.fallbackOrder);
      if (fallback) {
        const selectedId = getModelId(fallback.model);
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

      // Build a map of model -> score from the breakdown.
      // When fallbackOrder is specified, only consider those models as candidates.
      const candidateIds = rule.fallbackOrder ? new Set(rule.fallbackOrder) : null;
      const modelScores = new Map<string, number>();
      const modelEntryMap = new Map<string, AdaptiveModelRouterModel>();
      for (const entry of this.models) {
        const id = getModelId(entry.model);
        if (candidateIds && !candidateIds.has(id) && id !== currentModelId) continue;
        modelEntryMap.set(id, entry);
      }

      let totalSamples = 0;
      for (const group of breakdown.groups) {
        const entityName = group.dimensions['entityName'];
        if (entityName && modelEntryMap.has(entityName)) {
          modelScores.set(entityName, group.value ?? 0);
          totalSamples++;
        }
      }

      if (totalSamples < minSamples) return undefined;

      // Find the best-rated model
      let bestEntry: AdaptiveModelRouterModel | undefined;
      let bestScore = -Infinity;
      let bestId = '';
      for (const [id, score] of modelScores) {
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
          bestEntry = modelEntryMap.get(id);
        }
      }

      // Only switch if the best model is different from the current one
      if (bestEntry && bestId !== currentModelId) {
        const reason = `Feedback '${rule.feedbackType}' favors '${bestId}' (score: ${bestScore.toFixed(2)})`;
        await this.notifyViolation('feedback', currentModelId, bestId, reason);
        return this.buildFallbackResult(bestEntry);
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

  async processInputStep(
    args: ProcessInputStepArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<ProcessInputStepResult | undefined> {
    const traceId = args.tracing?.currentSpan?.traceId;
    const resolved = this.resolveScopeFilter(args.requestContext, traceId);
    const scopeKey = resolved?.scopeKey;
    const scopeFilter = resolved?.filter;

    const currentModelId =
      typeof args.model === 'string' ? args.model : 'modelId' in args.model ? getModelId(args.model) : 'unknown';

    // Always track state so processAPIError and processOutputStep know which
    // model was used — even without scope context the reactive fallback path
    // (processAPIError → retry → processInputStep) must work.
    args.state.__adaptiveRouter_currentModelId = currentModelId;
    args.state.__adaptiveRouter_scopeKey = scopeKey;

    // Quick cooldown check: if the current model is in cooldown (from a prior
    // processAPIError or processOutputStep), skip to the next available model.
    // This works with or without scope — getCooldownKey uses 'global' when
    // scopeKey is undefined, which is the reactive-only fallback path.
    if (await this.isModelInCooldown(currentModelId, this.defaultCooldownMs, scopeKey)) {
      const fallback = await this.findAvailableFallback(currentModelId, this.defaultCooldownMs, scopeKey);
      if (fallback) {
        const selectedId = getModelId(fallback.model);
        await this.notifyViolation(
          'error-rate',
          currentModelId,
          selectedId,
          'Model in cooldown (skipping in fallback chain)',
        );
        args.state.__adaptiveRouter_currentModelId = selectedId;
        return this.buildFallbackResult(fallback);
      }
      // All models in cooldown -- let the normal chain proceed
      return undefined;
    }

    // Observability rules require scope context for data queries.
    // Without scope the router still provides reactive fallback via
    // processAPIError, but proactive rule evaluation is skipped.
    if (!scopeFilter) return undefined;

    // Evaluate rules in priority order -- first rule that fires wins
    for (const rule of this.rules) {
      let result: ProcessInputStepResult | undefined;

      if (rule.signal === 'error-rate') {
        result = await this.evaluateErrorRateRule(rule, currentModelId, scopeFilter, scopeKey);
      } else if (rule.signal === 'score') {
        result = await this.evaluateScoreRule(rule, currentModelId, scopeFilter, scopeKey);
      } else if (rule.signal === 'feedback') {
        result = await this.evaluateFeedbackRule(rule, currentModelId, scopeFilter);
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
   * behavior -- even without observability data, the router can react to
   * real-time failures and route to healthy models.
   */
  async processAPIError(
    args: ProcessAPIErrorArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<ProcessAPIErrorResult | void> {
    const failedModelId = args.state.__adaptiveRouter_currentModelId as string | undefined;
    if (!failedModelId) return undefined;

    const scopeKey = args.state.__adaptiveRouter_scopeKey as string | undefined;

    // Don't retry if we've exhausted fallbacks (tracked in state)
    const retriedModels = (args.state.__adaptiveRouter_retriedModels as string[] | undefined) ?? [];
    const allRetried = this.modelIds.every(id => id === failedModelId || retriedModels.includes(id));
    if (allRetried) return undefined;

    // Open the circuit for the failed model so processInputStep skips it on retry.
    // scopeKey may be undefined — getCooldownKey uses 'global' in that case.
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
   *
   * Returns the messageList unchanged -- this hook is purely for side-effects
   * (opening circuits in the cache).
   */
  async processOutputStep(
    args: ProcessOutputStepArgs<AdaptiveModelRouterTripwireMetadata>,
  ): Promise<MastraDBMessage[]> {
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
