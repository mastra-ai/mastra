import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import { parseMemoryRequestContext } from '../../memory/types';
import { EntityType } from '../../observability';
import type { RequestContext } from '../../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { ProcessInputStepArgs, Processor, ProcessorViolation } from '../index';

/**
 * Cost scope determines what usage is tracked:
 * - 'run': Only cost from the current agent run
 * - 'resource': Cumulative cost across runs for the same resourceId (default)
 * - 'thread': Cumulative cost across runs for the same threadId
 */
export type CostScope = 'run' | 'resource' | 'thread';

/**
 * Named time windows for cost aggregation.
 * Only applicable to 'resource' and 'thread' scopes.
 */
export type CostWindow = '1h' | '6h' | '24h' | '7d' | '30d' | '365d';

/**
 * Cost usage summary for cost guard decisions
 */
export interface CostGuardUsage {
  estimatedCost: number | null;
  costUnit: string | null;
}

/**
 * Metadata attached to the TripWire when the cost guard aborts
 */
export interface CostGuardTripwireMetadata {
  processorId: 'cost-guard';
  usage: CostGuardUsage;
  maxCost: number;
  scope: CostScope;
  scopeKey?: string;
}

/**
 * Configuration options for CostGuardProcessor
 */
export interface CostGuardOptions {
  /**
   * Maximum estimated cost allowed (e.g. 0.50 for $0.50 USD).
   * Uses the cost data from observability metrics.
   */
  maxCost: number;

  /**
   * Scope for cost tracking:
   * - 'run': Track cost within the current agent run only
   * - 'resource': Track cumulative cost per resourceId across runs (default)
   * - 'thread': Track cumulative cost per threadId across runs
   */
  scope?: CostScope;

  /**
   * Time window for cost aggregation when using 'resource' or 'thread' scope.
   * Defaults to '7d' (7 days). Only applicable to non-run scopes.
   * - '1h': Last hour
   * - '6h': Last 6 hours
   * - '24h': Last 24 hours
   * - '7d': Last 7 days
   * - '30d': Last 30 days
   * - '365d': Last 365 days
   */
  window?: CostWindow;

  /**
   * Strategy when the cost limit is exceeded:
   * - 'block': Abort with a TripWire error (default)
   * - 'warn': Log a warning but allow the step to proceed
   */
  strategy?: 'block' | 'warn';

  /**
   * Custom message template for the abort reason.
   * Placeholders: {usage}, {limit}
   */
  message?: string;

  /**
   * Optional soft threshold as a percentage of maxCost (exclusive 0-100, e.g. 80).
   * When the estimated cost reaches this percentage of the limit (but is still
   * below it), a warning is logged and onViolation is called once per request,
   * regardless of strategy. Never aborts the step.
   */
  warnAtPercent?: number;
}

/**
 * Cost guard specific violation detail
 */
export interface CostGuardViolationDetail {
  usage: number;
  limit: number;
  totalUsage: CostGuardUsage;
  scope: CostScope;
  scopeKey?: string;
  /**
   * Which threshold was crossed: 'soft' for the warnAtPercent threshold,
   * 'hard' for the maxCost limit.
   */
  threshold: 'soft' | 'hard';
}

const WARNED_HARD_STATE_KEY = 'costGuardWarned:hard';
const WARNED_SOFT_STATE_KEY = 'costGuardWarned:soft';

const WINDOW_MS: Record<CostWindow, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
};

/**
 * CostGuardProcessor monitors cumulative estimated cost across the agentic loop,
 * blocking or warning when a configurable monetary limit is exceeded.
 *
 * **Important:** This is an approximate cost guard. Cost data is queried from
 * observability storage, which persists metrics asynchronously via buffered exporters.
 * Fast-running agents may exceed the configured limit before metrics are available
 * for query. Treat `maxCost` as a best-effort threshold, not a hard ceiling.
 *
 * **Important:** Cost is attributed via the `entityType: 'agent'` metric filter.
 * Model calls made outside an agent run — for example direct model usage in
 * workflow steps — have no agent parent span and are NOT counted by this guard.
 *
 * Uses `processInputStep` to check the cost limit before each LLM call.
 * Queries the observability storage APIs (`getMetricAggregate`) to retrieve
 * estimated cost. For 'resource' and 'thread' scopes, aggregates cost across
 * runs within a configurable time window (defaults to 7 days). For 'run' scope,
 * queries cost for the current trace.
 *
 * For token-based limits, use `TokenLimiterProcessor` instead.
 *
 * Requires observability storage with `getMetricAggregate` support. If the Mastra
 * instance does not have observability storage configured, an error is thrown at
 * registration time.
 *
 * @example Resource-scoped cost limit (default):
 * ```typescript
 * new CostGuardProcessor({
 *   maxCost: 1.00,
 * })
 * ```
 *
 * @example Thread-scoped with 24h window:
 * ```typescript
 * new CostGuardProcessor({
 *   maxCost: 5.00,
 *   scope: 'thread',
 *   window: '24h',
 * })
 * ```
 *
 * @example With onViolation callback:
 * ```typescript
 * const guard = new CostGuardProcessor({
 *   maxCost: 10.00,
 *   scope: 'resource',
 *   window: '30d',
 * });
 * guard.onViolation = ({ detail }) => {
 *   alertSystem.notify(`Cost limit exceeded for ${detail.scopeKey}: $${detail.usage}/$${detail.limit}`);
 * };
 * ```
 */
export class CostGuardProcessor implements Processor<'cost-guard', CostGuardTripwireMetadata> {
  public readonly id = 'cost-guard';
  public readonly name = 'Cost Guard';

  private maxCost: number;
  private scope: CostScope;
  private window: CostWindow;
  private strategy: 'block' | 'warn';
  private messageTemplate: string;
  private warnAtPercent?: number;
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;
  private observabilityStorage?: ObservabilityStorage;
  private logger?: IMastraLogger;

  constructor(options: CostGuardOptions) {
    if (options.maxCost <= 0) {
      throw new Error('CostGuardProcessor requires maxCost to be a positive number');
    }

    if (options.warnAtPercent !== undefined) {
      if (!Number.isFinite(options.warnAtPercent) || options.warnAtPercent <= 0 || options.warnAtPercent >= 100) {
        throw new Error('CostGuardProcessor requires warnAtPercent to be a number between 0 and 100 (exclusive)');
      }
      this.warnAtPercent = options.warnAtPercent;
    }

    this.maxCost = options.maxCost;
    this.scope = options.scope ?? 'resource';
    this.window = options.window ?? '7d';
    this.strategy = options.strategy ?? 'block';
    this.messageTemplate = options.message ?? 'Cost guard: estimated cost limit exceeded ({usage}/{limit})';
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    const storage = mastra.getStorage();
    const obsStorage = storage?.stores?.observability;
    if (!obsStorage || typeof obsStorage.getMetricAggregate !== 'function') {
      throw new Error(
        `CostGuardProcessor requires observability storage with getMetricAggregate support. ` +
          'Configure observability storage on your Mastra instance.',
      );
    }
    this.observabilityStorage = obsStorage;
    this.logger = mastra.getLogger();
  }

  private resolveScopeFilter(
    requestContext?: RequestContext,
    traceId?: string,
  ): { filter: Record<string, string>; scopeKey?: string } | undefined {
    if (this.scope === 'run') {
      if (!traceId) return undefined;
      return { filter: { traceId } };
    }

    // Reserved keys from RequestContext take precedence (set by auth middleware).
    // Fall back to the MastraMemory context populated by prepare-memory-step,
    // which is how threadId/resourceId are available when there is no auth layer
    // (e.g. Studio dev mode).
    const memoryContext = parseMemoryRequestContext(requestContext);

    if (this.scope === 'resource') {
      const resourceId =
        (requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined) ?? memoryContext?.resourceId;
      if (!resourceId) return undefined;
      return { filter: { resourceId }, scopeKey: `resource:${resourceId}` };
    }
    if (this.scope === 'thread') {
      const threadId = (requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ?? memoryContext?.thread?.id;
      if (!threadId) return undefined;
      return { filter: { threadId }, scopeKey: `thread:${threadId}` };
    }
    return undefined;
  }

  private getWindowTimestamp(): { start: Date } {
    const windowMs = WINDOW_MS[this.window];
    return { start: new Date(Date.now() - windowMs) };
  }

  private async queryCost(scopeFilter: Record<string, string>): Promise<CostGuardUsage> {
    if (!this.observabilityStorage) {
      return { estimatedCost: null, costUnit: null };
    }
    try {
      const filters: Record<string, unknown> = {
        ...scopeFilter,
        entityType: EntityType.AGENT,
      };

      // Apply time window for resource/thread scopes
      if (this.scope !== 'run') {
        filters['timestamp'] = this.getWindowTimestamp();
      }

      const result = await this.observabilityStorage.getMetricAggregate({
        name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
        aggregation: 'sum',
        filters,
      });

      const totalCost = result.estimatedCost ?? 0;

      return {
        estimatedCost: totalCost > 0 ? totalCost : null,
        costUnit: result.costUnit ?? null,
      };
    } catch (error) {
      this.logger?.warn('CostGuardProcessor: cost query failed; allowing step (fail-open)', { error });
      return { estimatedCost: null, costUnit: null };
    }
  }

  // Normalize float precision artifacts (e.g. 0.30000000000000004 → 0.3)
  private formatNumber(value: number): string {
    return String(Number(value.toFixed(6)));
  }

  private formatMessage(usage: number, limit: number): string {
    return this.messageTemplate
      .replace('{usage}', this.formatNumber(usage))
      .replace('{limit}', this.formatNumber(limit));
  }

  private async emitWarning(message: string, detail: CostGuardViolationDetail): Promise<void> {
    if (this.onViolation) {
      try {
        await this.onViolation({
          processorId: this.id,
          message,
          detail,
        });
      } catch (error) {
        // onViolation errors should not prevent the guard from functioning
        this.logger?.warn('CostGuardProcessor: onViolation callback threw', { error });
      }
    }
    this.logger?.warn(`CostGuardProcessor: ${message}`);
  }

  async processInputStep(args: ProcessInputStepArgs<CostGuardTripwireMetadata>): Promise<void> {
    const traceId = args.tracing?.currentSpan?.traceId;
    const resolved = this.resolveScopeFilter(args.requestContext, traceId);
    if (!resolved) return;

    const { filter, scopeKey } = resolved;
    const usage = await this.queryCost(filter);

    if (usage.estimatedCost === null) return;
    const cost = usage.estimatedCost;

    // Hard limit
    if (cost >= this.maxCost) {
      const message = this.formatMessage(cost, this.maxCost);

      if (this.strategy === 'warn') {
        // Fire the warning and onViolation at most once per request
        if (!args.state[WARNED_HARD_STATE_KEY]) {
          args.state[WARNED_HARD_STATE_KEY] = true;
          await this.emitWarning(message, {
            usage: cost,
            limit: this.maxCost,
            totalUsage: usage,
            scope: this.scope,
            scopeKey,
            threshold: 'hard',
          });
        }
        return;
      }

      args.abort(message, {
        retry: false,
        metadata: {
          processorId: this.id,
          usage,
          maxCost: this.maxCost,
          scope: this.scope,
          scopeKey,
        },
      });
    }

    // Soft threshold (cost < maxCost here)
    if (this.warnAtPercent !== undefined && cost >= (this.maxCost * this.warnAtPercent) / 100) {
      if (!args.state[WARNED_SOFT_STATE_KEY]) {
        args.state[WARNED_SOFT_STATE_KEY] = true;
        const message = `Cost guard: estimated cost reached ${this.warnAtPercent}% of the limit (${this.formatNumber(cost)}/${this.formatNumber(this.maxCost)})`;
        await this.emitWarning(message, {
          usage: cost,
          limit: this.maxCost,
          totalUsage: usage,
          scope: this.scope,
          scopeKey,
          threshold: 'soft',
        });
      }
    }
  }
}
