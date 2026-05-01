import type { StepResult } from '@internal/ai-sdk-v5';
import type { Mastra } from '../../mastra';
import { EntityType } from '../../observability';
import type { RequestContext } from '../../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { LanguageModelUsage } from '../../stream/types';
import type { ProcessInputStepArgs, Processor, ProcessorViolation } from '../index';

/**
 * Cost scope determines what usage is tracked:
 * - 'run': Only tokens from the current agent run (default)
 * - 'resource': Cumulative cost across runs for the same resourceId (requires observability storage)
 * - 'thread': Cumulative cost across runs for the same threadId (requires observability storage)
 */
export type CostScope = 'run' | 'resource' | 'thread';

/**
 * Named time windows for cost aggregation
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
   * - 'run': Track cost within the current agent run only (default)
   * - 'resource': Track cumulative cost per resourceId across runs (requires observability storage)
   * - 'thread': Track cumulative cost per threadId across runs (requires observability storage)
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
   * @deprecated Use the `onViolation` property on the Processor interface instead.
   * Callback invoked when a cost violation is detected, regardless of strategy.
   */
  onViolation?: (violation: ProcessorViolation) => void | Promise<void>;
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
}

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
 * Uses `processInputStep` to check the cost limit before each LLM call. For 'resource' and 'thread'
 * scopes, queries the observability storage APIs to retrieve cumulative cost across runs within
 * a configurable time window (defaults to 7 days).
 *
 * For token-based limits, use `TokenLimiterProcessor` instead.
 *
 * Requires the observability APIs (specifically `getMetricAggregate`) when using 'resource'
 * or 'thread' scopes. If the Mastra instance does not have observability storage configured,
 * an error is thrown at registration time.
 *
 * @example Run-scoped cost limit:
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
  public onViolation?: (violation: ProcessorViolation) => void | Promise<void>;
  private observabilityStorage?: ObservabilityStorage;

  constructor(options: CostGuardOptions) {
    if (options.maxCost <= 0) {
      throw new Error('CostGuardProcessor requires maxCost to be a positive number');
    }

    this.maxCost = options.maxCost;
    this.scope = options.scope ?? 'run';
    this.window = options.window ?? '7d';
    this.strategy = options.strategy ?? 'block';
    this.messageTemplate = options.message ?? 'Cost guard: cost limit exceeded ({usage}/{limit})';
    this.onViolation = options.onViolation;
  }

  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    if (this.scope !== 'run') {
      const storage = mastra.getStorage();
      const obsStorage = storage?.stores?.observability;
      if (!obsStorage || typeof obsStorage.getMetricAggregate !== 'function') {
        throw new Error(
          `CostGuardProcessor with scope '${this.scope}' requires observability storage with getMetricAggregate support. ` +
            'Configure observability storage on your Mastra instance to use resource or thread scoping.',
        );
      }
      this.observabilityStorage = obsStorage;
    }
  }

  private computeRunCost(steps: Array<StepResult<any>>): CostGuardUsage {
    let totalCost = 0;
    let costUnit: string | null = null;
    for (const step of steps) {
      const usage = step.usage as LanguageModelUsage | undefined;
      if (usage) {
        const meta = step.providerMetadata as Record<string, Record<string, unknown>> | undefined;
        const costInfo = meta?.['mastra']?.['cost'] as { estimatedCost?: number; costUnit?: string } | undefined;
        if (costInfo?.estimatedCost) {
          totalCost += costInfo.estimatedCost;
          if (costInfo.costUnit) costUnit = costInfo.costUnit;
        }
      }
    }
    return {
      estimatedCost: totalCost > 0 ? totalCost : null,
      costUnit,
    };
  }

  private resolveScopeFilter(requestContext?: RequestContext): { resourceId?: string; threadId?: string } | undefined {
    if (this.scope === 'resource') {
      const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
      return resourceId ? { resourceId } : undefined;
    }
    if (this.scope === 'thread') {
      const threadId = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
      return threadId ? { threadId } : undefined;
    }
    return undefined;
  }

  private getWindowTimestamp(): { start: Date } {
    const windowMs = WINDOW_MS[this.window];
    return { start: new Date(Date.now() - windowMs) };
  }

  private async queryPersistedCost(scopeFilter: { resourceId?: string; threadId?: string }): Promise<CostGuardUsage> {
    if (!this.observabilityStorage) {
      return { estimatedCost: null, costUnit: null };
    }
    try {
      const filters = {
        ...scopeFilter,
        entityType: EntityType.AGENT,
        timestamp: this.getWindowTimestamp(),
      };

      const [inputResult, outputResult] = await Promise.all([
        this.observabilityStorage.getMetricAggregate({
          name: ['mastra_model_total_input_tokens'],
          aggregation: 'sum',
          filters,
        }),
        this.observabilityStorage.getMetricAggregate({
          name: ['mastra_model_total_output_tokens'],
          aggregation: 'sum',
          filters,
        }),
      ]);

      const inputCost = inputResult.estimatedCost ?? 0;
      const outputCost = outputResult.estimatedCost ?? 0;
      const totalCost = inputCost + outputCost;
      const costUnit = inputResult.costUnit ?? outputResult.costUnit ?? null;

      return {
        estimatedCost: totalCost > 0 ? totalCost : null,
        costUnit,
      };
    } catch {
      return { estimatedCost: null, costUnit: null };
    }
  }

  private async getTotalUsage(
    steps: Array<StepResult<any>>,
    requestContext?: RequestContext,
  ): Promise<{ usage: CostGuardUsage; scopeKey?: string }> {
    const runUsage = this.computeRunCost(steps);

    if (this.scope === 'run') {
      return { usage: runUsage };
    }

    const scopeFilter = this.resolveScopeFilter(requestContext);
    if (!scopeFilter) {
      return { usage: runUsage };
    }

    const scopeKey = scopeFilter.resourceId ? `resource:${scopeFilter.resourceId}` : `thread:${scopeFilter.threadId}`;

    const persistedUsage = await this.queryPersistedCost(scopeFilter);
    const runCost = runUsage.estimatedCost ?? 0;
    const persistedCost = persistedUsage.estimatedCost ?? 0;
    const totalCost = runCost + persistedCost;

    return {
      usage: {
        estimatedCost: totalCost > 0 ? totalCost : null,
        costUnit: persistedUsage.costUnit ?? runUsage.costUnit,
      },
      scopeKey,
    };
  }

  private formatMessage(usage: number, limit: number): string {
    return this.messageTemplate.replace('{usage}', String(usage)).replace('{limit}', String(limit));
  }

  async processInputStep(args: ProcessInputStepArgs<CostGuardTripwireMetadata>): Promise<void> {
    const { usage, scopeKey } = await this.getTotalUsage(args.steps, args.requestContext);

    if (usage.estimatedCost === null || usage.estimatedCost < this.maxCost) return;

    const message = this.formatMessage(usage.estimatedCost, this.maxCost);

    if (this.onViolation) {
      try {
        await this.onViolation({
          processorId: this.id,
          message,
          detail: {
            usage: usage.estimatedCost,
            limit: this.maxCost,
            totalUsage: usage,
            scope: this.scope,
            scopeKey,
          },
        });
      } catch {
        // onViolation errors should not prevent the guard from functioning
      }
    }

    if (this.strategy === 'warn') {
      console.warn(`[CostGuardProcessor] ${message}`);
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
}
