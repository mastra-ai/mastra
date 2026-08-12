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
 * - 'user': Cumulative cost across runs for the same userId
 * - 'organization': Cumulative cost across runs for the same organizationId
 * - 'session': Cumulative cost across runs for the same sessionId
 *
 * The 'user', 'organization', and 'session' scopes read the plain
 * RequestContext keys `userId` / `organizationId` / `sessionId` and only match
 * metrics whose traces carry the corresponding span metadata. If the key is
 * missing from the RequestContext, the check is skipped (fail-open).
 */
export type CostScope = 'run' | 'resource' | 'thread' | 'user' | 'organization' | 'session';

/**
 * Named time windows for cost aggregation.
 * Applicable to all scopes except 'run'.
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
 * Per-provider/model cost breakdown entry attached to violations when
 * `includeBreakdown` is enabled.
 */
export interface CostGuardBreakdownEntry {
  provider: string | null;
  model: string | null;
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
  /**
   * Which threshold was crossed. Always 'hard' — only the hard limit aborts.
   */
  threshold: 'hard';
  /**
   * Per-provider/model cost breakdown. Present only when `includeBreakdown`
   * is enabled and the breakdown query succeeds.
   */
  breakdown?: CostGuardBreakdownEntry[];
}

/**
 * Configuration options for CostGuardProcessor
 */
export interface CostGuardOptions {
  /**
   * Maximum estimated cost allowed (e.g. 0.50 for $0.50 USD).
   * Uses the cost data from observability metrics.
   *
   * Accepts either a fixed number or a function of the request's
   * RequestContext for per-request budgets (e.g. per-tier limits). If the
   * function returns anything other than a finite positive number, the check
   * is skipped for that request (fail-open) and a warning is logged.
   */
  maxCost: number | ((requestContext?: RequestContext) => number);

  /**
   * Scope for cost tracking:
   * - 'run': Track cost within the current agent run only
   * - 'resource': Track cumulative cost per resourceId across runs (default)
   * - 'thread': Track cumulative cost per threadId across runs
   * - 'user': Track cumulative cost per userId across runs (reads the plain
   *   RequestContext key `userId`; requires traces annotated with userId metadata)
   * - 'organization': Track cumulative cost per organizationId across runs
   *   (RequestContext key `organizationId`; requires annotated traces)
   * - 'session': Track cumulative cost per sessionId across runs
   *   (RequestContext key `sessionId`; requires annotated traces)
   */
  scope?: CostScope;

  /**
   * Time window for cost aggregation for all scopes except 'run'.
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

  /**
   * When true, violations (soft and hard) include a per-provider/model cost
   * breakdown queried via `getMetricBreakdown`. Defaults to false. The
   * breakdown query runs only when a violation trips — never on the happy
   * path. If the store does not support breakdowns (or the query fails), the
   * violation fires without the `breakdown` field.
   */
  includeBreakdown?: boolean;
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
  /**
   * Per-provider/model cost breakdown. Present only when `includeBreakdown`
   * is enabled and the breakdown query succeeds.
   */
  breakdown?: CostGuardBreakdownEntry[];
}

const TOKEN_TOTAL_METRIC_NAMES = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'];

/**
 * Monotonic counter distinguishing CostGuardProcessor instances in per-request
 * dedup state keys. The runner keys the state bag by processor id, which is
 * hardcoded 'cost-guard', so multiple instances in one pipeline share a bag.
 */
let costGuardInstanceCounter = 0;

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
 * estimated cost. For the 'resource', 'thread', 'user', 'organization', and
 * 'session' scopes, aggregates cost across runs within a configurable time
 * window (defaults to 7 days). For 'run' scope, queries cost for the current
 * trace.
 *
 * The 'user', 'organization', and 'session' scopes resolve their IDs from the
 * plain RequestContext keys `userId` / `organizationId` / `sessionId` and only
 * see metrics whose traces carry matching span metadata; unannotated traces
 * are invisible to these scopes.
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
 * @example With onViolation callback (warn strategy — detail is CostGuardViolationDetail;
 * with the block strategy the runner passes the TripWire metadata as detail instead):
 * ```typescript
 * const guard = new CostGuardProcessor({
 *   maxCost: 10.00,
 *   scope: 'resource',
 *   window: '30d',
 *   strategy: 'warn',
 * });
 * guard.onViolation = ({ detail }) => {
 *   alertSystem.notify(`Cost limit exceeded for ${detail.scopeKey}: $${detail.usage}/$${detail.limit}`);
 * };
 * ```
 */
export class CostGuardProcessor implements Processor<'cost-guard', CostGuardTripwireMetadata> {
  public readonly id = 'cost-guard';
  public readonly name = 'Cost Guard';

  private maxCost: number | ((requestContext?: RequestContext) => number);
  private scope: CostScope;
  private window: CostWindow;
  private strategy: 'block' | 'warn';
  private messageTemplate: string;
  private warnAtPercent?: number;
  private includeBreakdown: boolean;
  private readonly instanceKey = costGuardInstanceCounter++;
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;
  private observabilityStorage?: ObservabilityStorage;
  private logger?: IMastraLogger;

  constructor(options: CostGuardOptions) {
    if (typeof options.maxCost === 'number' && (!Number.isFinite(options.maxCost) || options.maxCost <= 0)) {
      throw new Error('CostGuardProcessor requires maxCost to be a finite positive number');
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
    this.includeBreakdown = options.includeBreakdown ?? false;
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
    // The user/organization/session scopes read plain RequestContext keys
    // (documented convention — no reserved keys or memory-context fallback).
    if (this.scope === 'user') {
      const userId = requestContext?.get('userId');
      if (typeof userId !== 'string' || !userId) return undefined;
      return { filter: { userId }, scopeKey: `user:${userId}` };
    }
    if (this.scope === 'organization') {
      const organizationId = requestContext?.get('organizationId');
      if (typeof organizationId !== 'string' || !organizationId) return undefined;
      return { filter: { organizationId }, scopeKey: `organization:${organizationId}` };
    }
    if (this.scope === 'session') {
      const sessionId = requestContext?.get('sessionId');
      if (typeof sessionId !== 'string' || !sessionId) return undefined;
      return { filter: { sessionId }, scopeKey: `session:${sessionId}` };
    }
    return undefined;
  }

  private getWindowTimestamp(): { start: Date } {
    const windowMs = WINDOW_MS[this.window];
    return { start: new Date(Date.now() - windowMs) };
  }

  private buildFilters(scopeFilter: Record<string, string>): Record<string, unknown> {
    const filters: Record<string, unknown> = {
      ...scopeFilter,
      entityType: EntityType.AGENT,
    };

    // Apply time window for all non-run scopes
    if (this.scope !== 'run') {
      filters['timestamp'] = this.getWindowTimestamp();
    }

    return filters;
  }

  private async queryCost(scopeFilter: Record<string, string>): Promise<CostGuardUsage> {
    if (!this.observabilityStorage) {
      return { estimatedCost: null, costUnit: null };
    }
    try {
      const filters = this.buildFilters(scopeFilter);

      const result = await this.observabilityStorage.getMetricAggregate({
        name: TOKEN_TOTAL_METRIC_NAMES,
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

  /**
   * Queries a per-provider/model cost breakdown for the current scope.
   * Only called when a violation trips and `includeBreakdown` is enabled.
   * Degrades to undefined on any error (e.g. stores without breakdown support).
   */
  private async queryBreakdown(scopeFilter: Record<string, string>): Promise<CostGuardBreakdownEntry[] | undefined> {
    if (!this.observabilityStorage) return undefined;
    try {
      const result = await this.observabilityStorage.getMetricBreakdown({
        name: TOKEN_TOTAL_METRIC_NAMES,
        groupBy: ['provider', 'model'],
        aggregation: 'sum',
        filters: this.buildFilters(scopeFilter),
        limit: 10,
      });
      return result.groups.map(group => ({
        provider: group.dimensions['provider'] ?? null,
        model: group.dimensions['model'] ?? null,
        estimatedCost: group.estimatedCost ?? null,
        costUnit: group.costUnit ?? null,
      }));
    } catch (error) {
      this.logger?.debug('CostGuardProcessor: breakdown query failed; omitting breakdown', { error });
      return undefined;
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

  /**
   * Builds the per-request dedup state key. Includes a per-instance component
   * so that multiple CostGuardProcessor instances in the same pipeline (which
   * share one state bag keyed by processor id) don't suppress each other's
   * warnings, and stays stable across steps even when a dynamic `maxCost`
   * resolves to different values per step.
   */
  private warnedStateKey(level: 'hard' | 'soft'): string {
    return `costGuardWarned:${level}:${this.instanceKey}`;
  }

  private resolveMaxCost(requestContext?: RequestContext): number | undefined {
    if (typeof this.maxCost === 'number') return this.maxCost;
    let value: number;
    try {
      value = this.maxCost(requestContext);
    } catch (error) {
      this.logger?.warn('CostGuardProcessor: dynamic maxCost function threw; skipping check (fail-open)', { error });
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      this.logger?.warn('CostGuardProcessor: dynamic maxCost resolved to an invalid value; skipping check', {
        value,
      });
      return undefined;
    }
    return value;
  }

  async processInputStep(args: ProcessInputStepArgs<CostGuardTripwireMetadata>): Promise<void> {
    const traceId = args.tracing?.currentSpan?.traceId;
    const resolved = this.resolveScopeFilter(args.requestContext, traceId);
    if (!resolved) return;

    const maxCost = this.resolveMaxCost(args.requestContext);
    if (maxCost === undefined) return;

    const { filter, scopeKey } = resolved;
    const usage = await this.queryCost(filter);

    if (usage.estimatedCost === null) return;
    const cost = usage.estimatedCost;

    // Hard limit
    if (cost >= maxCost) {
      const message = this.formatMessage(cost, maxCost);

      if (this.strategy === 'warn') {
        // Fire the warning and onViolation at most once per request
        const stateKey = this.warnedStateKey('hard');
        if (!args.state[stateKey]) {
          args.state[stateKey] = true;
          const breakdown = this.includeBreakdown ? await this.queryBreakdown(filter) : undefined;
          await this.emitWarning(message, {
            usage: cost,
            limit: maxCost,
            totalUsage: usage,
            scope: this.scope,
            scopeKey,
            threshold: 'hard',
            ...(breakdown ? { breakdown } : {}),
          });
        }
        return;
      }

      const breakdown = this.includeBreakdown ? await this.queryBreakdown(filter) : undefined;
      args.abort(message, {
        retry: false,
        metadata: {
          processorId: this.id,
          usage,
          maxCost,
          scope: this.scope,
          scopeKey,
          threshold: 'hard',
          ...(breakdown ? { breakdown } : {}),
        },
      });
      return;
    }

    // Soft threshold (cost < maxCost here)
    if (this.warnAtPercent !== undefined && cost >= (maxCost * this.warnAtPercent) / 100) {
      const stateKey = this.warnedStateKey('soft');
      if (!args.state[stateKey]) {
        args.state[stateKey] = true;
        const message = `Cost guard: estimated cost reached ${this.warnAtPercent}% of the limit (${this.formatNumber(cost)}/${this.formatNumber(maxCost)})`;
        const breakdown = this.includeBreakdown ? await this.queryBreakdown(filter) : undefined;
        await this.emitWarning(message, {
          usage: cost,
          limit: maxCost,
          totalUsage: usage,
          scope: this.scope,
          scopeKey,
          threshold: 'soft',
          ...(breakdown ? { breakdown } : {}),
        });
      }
    }
  }
}
