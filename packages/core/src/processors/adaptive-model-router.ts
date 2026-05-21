import type { ModelFallbackSettings } from '../agent/types';
import type { DynamicArgument } from '../base';
import type { MastraLanguageModel, MastraModelConfig, SharedProviderOptions } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from './index';

export type RouterScope = 'run' | 'resource' | 'thread';
export type RouterWindow = '5m' | '1h' | '6h' | '24h' | '7d' | '30d' | '365d';
export type MastraMetricName =
  | 'mastra_model_duration_ms'
  | 'mastra_model_total_input_tokens'
  | 'mastra_model_total_output_tokens'
  | 'mastra_agent_duration_ms'
  | 'mastra_tool_duration_ms'
  | (string & {});

export type ErrorRateRule = {
  signal: 'error-rate';
  metric?: MastraMetricName;
  threshold?: number;
  minRequests?: number;
  window?: RouterWindow;
  cooldown?: RouterWindow | `${number}m` | `${number}h` | `${number}d`;
  fallbackOrder?: string[];
};

export type ScoreRule = {
  signal: 'score';
  scorerId: string;
  minScore: number;
  aggregation?: 'avg' | 'min' | 'max';
  window?: RouterWindow;
  cooldown?: RouterWindow | `${number}m` | `${number}h` | `${number}d`;
  fallbackOrder?: string[];
};

export type FeedbackRule = {
  signal: 'feedback';
  feedbackType: string;
  strategy?: 'best-rated';
  aggregation?: 'avg' | 'min' | 'max';
  minSamples?: number;
  window?: RouterWindow;
  cooldown?: RouterWindow | `${number}m` | `${number}h` | `${number}d`;
  fallbackOrder?: string[];
};

export type AdaptiveModelRouterRule = ErrorRateRule | ScoreRule | FeedbackRule;

export type AdaptiveModelRouterTripwireMetadata = {
  processorId: 'adaptive-model-router';
  rule: AdaptiveModelRouterRule;
  originalModel: string;
  selectedModel: string;
  reason: string;
};

export type AdaptiveModelRouterViolationDetail = Omit<AdaptiveModelRouterTripwireMetadata, 'processorId'>;

export type AdaptiveModelRouterModel = {
  id: string;
  model: MastraLanguageModel | MastraModelConfig;
  maxRetries?: number;
  enabled?: boolean;
  modelSettings?: DynamicArgument<ModelFallbackSettings> | ModelFallbackSettings;
  providerOptions?: DynamicArgument<SharedProviderOptions> | SharedProviderOptions;
  headers?: DynamicArgument<Record<string, string>> | Record<string, string>;
};

export type AdaptiveModelRouterOptions = {
  models: AdaptiveModelRouterModel[];
  rules?: AdaptiveModelRouterRule[];
  scope?: RouterScope;
  window?: RouterWindow;
  cooldown?: RouterWindow | `${number}m` | `${number}h` | `${number}d`;
  errorRateThreshold?: number;
  minRequests?: number;
};

type RouterState = {
  originalModelId?: string;
  selectedModelId?: string;
  currentRule?: AdaptiveModelRouterRule;
  attemptedModelIds?: string[];
  skippedModelIds?: string[];
  activeFallbackOrder?: string[];
};

type FiredRule = {
  rule: AdaptiveModelRouterRule;
  reason: string;
  selectedModelId?: string;
};

const DEFAULT_SCOPE: RouterScope = 'resource';
const DEFAULT_WINDOW: RouterWindow = '24h';
const DEFAULT_COOLDOWN = '2m';
const DEFAULT_ERROR_RATE_THRESHOLD = 0.3;
const DEFAULT_MIN_REQUESTS = 5;

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid AdaptiveModelRouter duration: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  return value * 24 * 60 * 60 * 1000;
}

function isEnabled(model: AdaptiveModelRouterModel): boolean {
  return model.enabled !== false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getCount(value: unknown): number {
  if (!isRecord(value)) return 0;
  for (const key of ['count', 'total', 'samples', 'sampleCount']) {
    const candidate = value[key];
    if (typeof candidate === 'number') return candidate;
  }
  return 0;
}

function getAggregateValue(value: unknown, aggregation: 'avg' | 'min' | 'max'): number | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of [aggregation, 'value', 'score', 'rating']) {
    const candidate = value[key];
    if (typeof candidate === 'number') return candidate;
  }
  return undefined;
}

export class AdaptiveModelRouter implements Processor<'adaptive-model-router', AdaptiveModelRouterTripwireMetadata> {
  readonly id = 'adaptive-model-router' as const;
  readonly name = 'Adaptive Model Router';
  onViolation?: (violation: { processorId: string; message: string; detail?: unknown }) => void | Promise<void>;
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  readonly #models: AdaptiveModelRouterModel[];
  readonly #modelIds: Set<string>;
  readonly #rules: AdaptiveModelRouterRule[];
  readonly #scope: RouterScope;

  constructor(options: AdaptiveModelRouterOptions) {
    const enabledModels = options.models.filter(isEnabled);
    if (enabledModels.length < 2) {
      throw new Error('AdaptiveModelRouter requires at least two enabled models');
    }

    this.#models = options.models;
    this.#modelIds = new Set(options.models.map(model => model.id));
    this.#scope = options.scope ?? DEFAULT_SCOPE;
    this.#rules = options.rules ?? [
      {
        signal: 'error-rate',
        threshold: options.errorRateThreshold ?? DEFAULT_ERROR_RATE_THRESHOLD,
        minRequests: options.minRequests ?? DEFAULT_MIN_REQUESTS,
        window: options.window ?? DEFAULT_WINDOW,
        cooldown: options.cooldown ?? DEFAULT_COOLDOWN,
      },
    ];

    for (const rule of this.#rules) {
      const fallbackOrder = rule.fallbackOrder;
      if (!fallbackOrder) continue;
      for (const modelId of fallbackOrder) {
        if (!this.#modelIds.has(modelId)) {
          throw new Error(`AdaptiveModelRouter fallbackOrder references unknown model id: ${modelId}`);
        }
      }
    }
  }

  get rules(): AdaptiveModelRouterRule[] {
    return this.#rules;
  }

  get models(): AdaptiveModelRouterModel[] {
    return this.#models;
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | void> {
    const state = this.#getState(args.state);
    state.originalModelId ??= this.#models.find(isEnabled)?.id;
    state.attemptedModelIds ??= [];
    state.skippedModelIds ??= [];

    const firedRule = args.retryCount > 0 ? undefined : await this.#evaluateRules(args);
    if (firedRule && state.originalModelId) {
      await this.#openCircuit(state.originalModelId, firedRule.rule);
    }
    const fallbackOrder =
      firedRule?.rule.fallbackOrder ?? state.activeFallbackOrder ?? this.#models.map(model => model.id);
    state.activeFallbackOrder = fallbackOrder;

    const selectedModel = await this.#selectEligibleModel({
      preferredModelId: firedRule?.selectedModelId,
      fallbackOrder,
      attemptedModelIds: state.attemptedModelIds,
      skippedModelIds: state.skippedModelIds,
    });

    if (!selectedModel) return;

    const previousModelId = state.selectedModelId;
    state.selectedModelId = selectedModel.id;
    state.currentRule = firedRule?.rule;

    if (firedRule && selectedModel.id !== state.originalModelId && selectedModel.id !== previousModelId) {
      await this.#emitViolation({
        rule: firedRule.rule,
        originalModel: state.originalModelId ?? selectedModel.id,
        selectedModel: selectedModel.id,
        reason: firedRule.reason,
      });
    }

    const [resolvedModelSettings, resolvedProviderOptions, resolvedHeaders] = await Promise.all([
      this.#resolveDynamic(selectedModel.modelSettings, args.requestContext),
      this.#resolveDynamic(selectedModel.providerOptions, args.requestContext),
      this.#resolveDynamic(selectedModel.headers, args.requestContext),
    ]);

    const modelSettings = {
      ...((resolvedModelSettings as object | undefined) ?? {}),
      ...(resolvedHeaders ? { headers: resolvedHeaders } : {}),
      ...(selectedModel.maxRetries !== undefined ? { maxRetries: selectedModel.maxRetries } : {}),
    } as any;

    return {
      model: selectedModel.model as MastraLanguageModel,
      modelSettings,
      providerOptions: resolvedProviderOptions as SharedProviderOptions | undefined,
    };
  }

  async #resolveDynamic<T>(
    value: DynamicArgument<T> | T | undefined,
    requestContext: ProcessInputStepArgs['requestContext'],
  ): Promise<T | undefined> {
    if (value === undefined) return undefined;
    if (typeof value !== 'function') return value as T;
    const result = (value as (args: { requestContext: any; mastra?: Mastra }) => Promise<T> | T)({
      requestContext: requestContext ?? ({} as any),
      mastra: this.mastra,
    });
    return await result;
  }

  async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    const state = this.#getState(args.state);
    const selectedModelId = state.selectedModelId ?? state.originalModelId ?? this.#models.find(isEnabled)?.id;
    if (!selectedModelId) return;
    const tentativeAttempted = Array.from(new Set([...(state.attemptedModelIds ?? []), selectedModelId]));
    const nextModel = await this.#selectEligibleModel({
      fallbackOrder: state.activeFallbackOrder ?? this.#models.map(model => model.id),
      attemptedModelIds: tentativeAttempted,
      skippedModelIds: state.skippedModelIds ?? [],
    });

    // Only commit attempted/circuit state when we actually have a different model to try.
    // This lets downstream error processors retry with the same model if they want to.
    if (!nextModel) return;

    state.attemptedModelIds = tentativeAttempted;
    await this.#openCircuit(selectedModelId, state.currentRule);

    args.rotateResponseMessageId?.();
    return { retry: true };
  }

  #getState(state: Record<string, unknown>): RouterState {
    const key = this.id;
    if (!isRecord(state[key])) {
      state[key] = {};
    }
    return state[key] as RouterState;
  }

  async #evaluateRules(args: ProcessInputStepArgs): Promise<FiredRule | undefined> {
    for (const rule of this.#rules) {
      const firedRule = await this.#evaluateRule(rule, args);
      if (firedRule) return firedRule;
    }
    return undefined;
  }

  async #evaluateRule(rule: AdaptiveModelRouterRule, args: ProcessInputStepArgs): Promise<FiredRule | undefined> {
    try {
      if (rule.signal === 'error-rate') return this.#evaluateErrorRateRule(rule, args);
      if (rule.signal === 'score') return this.#evaluateScoreRule(rule, args);
      return this.#evaluateFeedbackRule(rule, args);
    } catch {
      return undefined;
    }
  }

  async #getObservabilityStorage(): Promise<any | undefined> {
    const storage = this.mastra?.getStorage?.();
    return storage?.getStore ? storage.getStore('observability') : undefined;
  }

  #scopeFilter(args: ProcessInputStepArgs): Record<string, unknown> | undefined {
    const requestContext = args.requestContext as Record<string, unknown> | undefined;
    if (this.#scope === 'thread') {
      const threadId = requestContext?.threadId;
      return typeof threadId === 'string' ? { threadId } : undefined;
    }
    if (this.#scope === 'run') {
      const runId = requestContext?.runId;
      return typeof runId === 'string' ? { runId } : undefined;
    }
    const resourceId = requestContext?.resourceId ?? requestContext?.agentId;
    return typeof resourceId === 'string' ? { resourceId } : undefined;
  }

  async #evaluateErrorRateRule(rule: ErrorRateRule, args: ProcessInputStepArgs): Promise<FiredRule | undefined> {
    const observability = await this.#getObservabilityStorage();
    if (!observability?.getMetricBreakdown) return undefined;

    const currentModelId = this.#getState(args.state).selectedModelId ?? this.#models.find(isEnabled)?.id;
    if (!currentModelId) return undefined;

    const scopeFilter = this.#scopeFilter(args);
    if (!scopeFilter) return undefined;

    const result = await observability.getMetricBreakdown({
      metricName: rule.metric ?? 'mastra_model_duration_ms',
      start: new Date(Date.now() - parseDurationMs(rule.window ?? DEFAULT_WINDOW)),
      end: new Date(),
      filters: { ...scopeFilter, modelId: currentModelId },
      groupBy: ['status', 'error'],
    });

    const rows = Array.isArray(result) ? result : Array.isArray(result?.breakdown) ? result.breakdown : [];
    const total = rows.reduce((sum: number, row: unknown) => sum + getCount(row), 0);
    const errors = rows.reduce((sum: number, row: unknown) => {
      if (!isRecord(row)) return sum;
      const labels = isRecord(row.labels) ? row.labels : row;
      const status = labels.status;
      const isError = labels.error === true || labels.error === 'true' || status === 'error' || status === 'failed';
      return isError ? sum + getCount(row) : sum;
    }, 0);

    const minRequests = rule.minRequests ?? DEFAULT_MIN_REQUESTS;
    if (total < minRequests) return undefined;

    const errorRate = total === 0 ? 0 : errors / total;
    if (errorRate <= (rule.threshold ?? DEFAULT_ERROR_RATE_THRESHOLD)) return undefined;

    return {
      rule,
      reason: `error rate ${errorRate.toFixed(2)} exceeded threshold ${rule.threshold ?? DEFAULT_ERROR_RATE_THRESHOLD}`,
    };
  }

  async #evaluateScoreRule(rule: ScoreRule, args: ProcessInputStepArgs): Promise<FiredRule | undefined> {
    const observability = await this.#getObservabilityStorage();
    if (!observability?.getScoreAggregate) return undefined;
    const scopeFilter = this.#scopeFilter(args);
    if (!scopeFilter) return undefined;

    const aggregation = rule.aggregation ?? 'avg';
    const result = await observability.getScoreAggregate({
      scorerId: rule.scorerId,
      aggregation,
      start: new Date(Date.now() - parseDurationMs(rule.window ?? DEFAULT_WINDOW)),
      end: new Date(),
      filters: scopeFilter,
    });
    const value = getAggregateValue(result, aggregation);
    if (value === undefined || value >= rule.minScore) return undefined;

    return { rule, reason: `${aggregation} score ${value} fell below ${rule.minScore}` };
  }

  async #evaluateFeedbackRule(rule: FeedbackRule, args: ProcessInputStepArgs): Promise<FiredRule | undefined> {
    const observability = await this.#getObservabilityStorage();
    if (!observability?.getFeedbackAggregate) return undefined;
    const scopeFilter = this.#scopeFilter(args);
    if (!scopeFilter) return undefined;

    const aggregation = rule.aggregation ?? 'avg';
    const fallbackOrder = rule.fallbackOrder ?? this.#models.map(model => model.id);
    let best: { modelId: string; rating: number } | undefined;

    for (const modelId of fallbackOrder) {
      const result = await observability.getFeedbackAggregate({
        feedbackType: rule.feedbackType,
        aggregation,
        start: new Date(Date.now() - parseDurationMs(rule.window ?? '7d')),
        end: new Date(),
        filters: { ...scopeFilter, modelId },
      });
      if (getCount(result) < (rule.minSamples ?? 10)) continue;
      const rating = getAggregateValue(result, aggregation);
      if (rating === undefined) continue;
      if (!best || rating > best.rating) best = { modelId, rating };
    }

    if (!best) return undefined;
    return { rule, reason: `feedback selected best rated model ${best.modelId}`, selectedModelId: best.modelId };
  }

  async #selectEligibleModel({
    preferredModelId,
    fallbackOrder,
    attemptedModelIds,
    skippedModelIds,
  }: {
    preferredModelId?: string;
    fallbackOrder: string[];
    attemptedModelIds: string[];
    skippedModelIds: string[];
  }): Promise<AdaptiveModelRouterModel | undefined> {
    const orderedIds = preferredModelId
      ? [preferredModelId, ...fallbackOrder.filter(id => id !== preferredModelId)]
      : fallbackOrder;
    for (const modelId of orderedIds) {
      if (attemptedModelIds.includes(modelId)) continue;
      const model = this.#models.find(candidate => candidate.id === modelId && isEnabled(candidate));
      if (!model) continue;
      if (await this.#isInCooldown(modelId)) {
        skippedModelIds.push(modelId);
        continue;
      }
      return model;
    }
    return undefined;
  }

  #cacheKey(modelId: string, rule?: AdaptiveModelRouterRule): string {
    return `adaptive-model-router:${this.id}:${rule?.signal ?? 'reactive'}:${modelId}`;
  }

  async #isInCooldown(modelId: string): Promise<boolean> {
    const cache = this.mastra?.getServerCache?.();
    if (!cache) return false;
    return Boolean(await cache.get(this.#cacheKey(modelId)));
  }

  async #openCircuit(modelId: string, rule?: AdaptiveModelRouterRule): Promise<void> {
    const cache = this.mastra?.getServerCache?.();
    if (!cache) return;
    const cooldown = rule?.cooldown ?? DEFAULT_COOLDOWN;
    await cache.set(this.#cacheKey(modelId, rule), 'open', parseDurationMs(cooldown));
    await cache.set(this.#cacheKey(modelId), 'open', parseDurationMs(cooldown));
  }

  async #emitViolation(detail: AdaptiveModelRouterViolationDetail): Promise<void> {
    try {
      await this.onViolation?.({
        processorId: this.id,
        message: detail.reason,
        detail,
      });
    } catch {}
  }
}
