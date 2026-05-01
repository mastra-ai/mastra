import type { StepResult } from '@internal/ai-sdk-v5';
import type { Mastra } from '../../mastra';
import { EntityType } from '../../observability';
import type { RequestContext } from '../../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { ObservabilityStorage } from '../../storage/domains';
import type { LanguageModelUsage } from '../../stream/types';
import type { ProcessInputStepArgs, Processor } from '../index';

/**
 * Cost scope determines what usage is tracked:
 * - 'run': Only tokens from the current agent run (default)
 * - 'resource': Cumulative tokens across runs for the same resourceId (requires observability storage)
 * - 'thread': Cumulative tokens across runs for the same threadId (requires observability storage)
 */
export type CostScope = 'run' | 'resource' | 'thread';

/**
 * Token and cost usage summary for cost guard decisions
 */
export interface CostGuardUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number | null;
  costUnit: string | null;
}

/**
 * Metadata attached to the TripWire when the cost guard aborts
 */
export interface CostGuardTripwireMetadata {
  processorId: 'cost-guard';
  usage: CostGuardUsage;
  limit: CostGuardLimits;
  scope: CostScope;
  scopeKey?: string;
}

/**
 * Cost guard limits configuration.
 * Set token-based limits and/or a monetary cost limit.
 */
export interface CostGuardLimits {
  /** Maximum total tokens (input + output) allowed */
  maxTotalTokens?: number;
  /** Maximum input tokens allowed */
  maxInputTokens?: number;
  /** Maximum output tokens allowed */
  maxOutputTokens?: number;
  /** Maximum estimated cost allowed (e.g. 0.50 for $0.50 USD). Uses the cost data from observability metrics. */
  maxCost?: number;
}

/**
 * Configuration options for CostGuardProcessor
 */
export interface CostGuardOptions {
  /**
   * Token and cost limits for the cost guard.
   * At least one limit must be set.
   */
  limits: CostGuardLimits;

  /**
   * Scope for cost tracking:
   * - 'run': Track usage within the current agent run only (default)
   * - 'resource': Track cumulative usage per resourceId across runs (requires observability storage)
   * - 'thread': Track cumulative usage per threadId across runs (requires observability storage)
   */
  scope?: CostScope;

  /**
   * Strategy when a limit is exceeded:
   * - 'block': Abort with a TripWire error (default)
   * - 'warn': Log a warning but allow the step to proceed
   */
  strategy?: 'block' | 'warn';

  /**
   * Custom message template for the abort reason.
   * Placeholders: {limitType}, {usage}, {limit}
   */
  message?: string;

  /**
   * Callback invoked when a limit violation is detected, regardless of strategy.
   * Use this for side effects like alerting, emailing users, or logging to external systems.
   */
  onViolation?: (violation: {
    limitType: string;
    usage: number;
    limit: number;
    totalUsage: CostGuardUsage;
    scope: CostScope;
    scopeKey?: string;
  }) => void | Promise<void>;
}

/**
 * CostGuardProcessor monitors cumulative token usage and estimated cost across the agentic loop,
 * blocking or warning when configurable limits are exceeded.
 *
 * Uses `processInputStep` to check limits before each LLM call. For 'resource' and 'thread'
 * scopes, queries the observability storage APIs to retrieve cumulative usage across runs.
 *
 * Requires the new observability APIs (specifically `getMetricAggregate`) when using 'resource'
 * or 'thread' scopes. If the Mastra instance does not have observability storage configured,
 * an error is thrown at registration time.
 *
 * @example Run-scoped (tracks usage within a single agent run):
 * ```typescript
 * new CostGuardProcessor({
 *   limits: { maxTotalTokens: 100_000 },
 * })
 * ```
 *
 * @example Thread-scoped with cost limit:
 * ```typescript
 * new CostGuardProcessor({
 *   limits: { maxCost: 1.00 },
 *   scope: 'thread',
 * })
 * ```
 *
 * @example With onViolation callback:
 * ```typescript
 * new CostGuardProcessor({
 *   limits: { maxCost: 5.00 },
 *   scope: 'resource',
 *   onViolation: ({ limitType, usage, limit, scope, scopeKey }) => {
 *     alertSystem.notify(`Cost limit exceeded for ${scopeKey}: ${usage}/${limit}`);
 *   },
 * })
 * ```
 */
export class CostGuardProcessor implements Processor<'cost-guard', CostGuardTripwireMetadata> {
  public readonly id = 'cost-guard';
  public readonly name = 'Cost Guard';

  private limits: CostGuardLimits;
  private scope: CostScope;
  private strategy: 'block' | 'warn';
  private messageTemplate: string;
  private onViolation?: CostGuardOptions['onViolation'];
  private observabilityStorage?: ObservabilityStorage;

  constructor(options: CostGuardOptions) {
    const { limits } = options;
    if (!limits.maxTotalTokens && !limits.maxInputTokens && !limits.maxOutputTokens && !limits.maxCost) {
      throw new Error('CostGuardProcessor requires at least one limit to be set');
    }

    this.limits = limits;
    this.scope = options.scope ?? 'run';
    this.strategy = options.strategy ?? 'block';
    this.messageTemplate = options.message ?? 'Cost guard: {limitType} limit exceeded ({usage}/{limit})';
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

  private sumStepsUsage(steps: Array<StepResult<any>>): CostGuardUsage {
    let inputTokens = 0;
    let outputTokens = 0;
    for (const step of steps) {
      const usage = step.usage as LanguageModelUsage | undefined;
      if (usage) {
        inputTokens += usage.inputTokens ?? 0;
        outputTokens += usage.outputTokens ?? 0;
      }
    }
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: null,
      costUnit: null,
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

  private async queryPersistedUsage(scopeFilter: { resourceId?: string; threadId?: string }): Promise<CostGuardUsage> {
    if (!this.observabilityStorage) {
      return { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: null, costUnit: null };
    }
    try {
      const filters = {
        ...scopeFilter,
        entityType: EntityType.AGENT,
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

      const inputTokens = inputResult.value ?? 0;
      const outputTokens = outputResult.value ?? 0;

      const inputCost = inputResult.estimatedCost ?? 0;
      const outputCost = outputResult.estimatedCost ?? 0;
      const totalCost = inputCost + outputCost;
      const costUnit = inputResult.costUnit ?? outputResult.costUnit ?? null;

      return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: totalCost > 0 ? totalCost : null,
        costUnit,
      };
    } catch {
      return { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: null, costUnit: null };
    }
  }

  private async getTotalUsage(
    steps: Array<StepResult<any>>,
    requestContext?: RequestContext,
  ): Promise<{ usage: CostGuardUsage; scopeKey?: string }> {
    const runUsage = this.sumStepsUsage(steps);

    if (this.scope === 'run') {
      return { usage: runUsage };
    }

    const scopeFilter = this.resolveScopeFilter(requestContext);
    if (!scopeFilter) {
      return { usage: runUsage };
    }

    const scopeKey = scopeFilter.resourceId ? `resource:${scopeFilter.resourceId}` : `thread:${scopeFilter.threadId}`;

    const persistedUsage = await this.queryPersistedUsage(scopeFilter);
    return {
      usage: {
        inputTokens: persistedUsage.inputTokens + runUsage.inputTokens,
        outputTokens: persistedUsage.outputTokens + runUsage.outputTokens,
        totalTokens: persistedUsage.totalTokens + runUsage.totalTokens,
        estimatedCost: persistedUsage.estimatedCost,
        costUnit: persistedUsage.costUnit,
      },
      scopeKey,
    };
  }

  private checkLimits(usage: CostGuardUsage): { limitType: string; usage: number; limit: number } | null {
    if (this.limits.maxTotalTokens && usage.totalTokens >= this.limits.maxTotalTokens) {
      return { limitType: 'maxTotalTokens', usage: usage.totalTokens, limit: this.limits.maxTotalTokens };
    }
    if (this.limits.maxInputTokens && usage.inputTokens >= this.limits.maxInputTokens) {
      return { limitType: 'maxInputTokens', usage: usage.inputTokens, limit: this.limits.maxInputTokens };
    }
    if (this.limits.maxOutputTokens && usage.outputTokens >= this.limits.maxOutputTokens) {
      return { limitType: 'maxOutputTokens', usage: usage.outputTokens, limit: this.limits.maxOutputTokens };
    }
    if (this.limits.maxCost && usage.estimatedCost !== null && usage.estimatedCost >= this.limits.maxCost) {
      return { limitType: 'maxCost', usage: usage.estimatedCost, limit: this.limits.maxCost };
    }
    return null;
  }

  private formatMessage(limitType: string, usage: number, limit: number): string {
    return this.messageTemplate
      .replace('{limitType}', limitType)
      .replace('{usage}', String(usage))
      .replace('{limit}', String(limit));
  }

  async processInputStep(args: ProcessInputStepArgs<CostGuardTripwireMetadata>): Promise<void> {
    const { usage, scopeKey } = await this.getTotalUsage(args.steps, args.requestContext);
    const violation = this.checkLimits(usage);

    if (!violation) return;

    const message = this.formatMessage(violation.limitType, violation.usage, violation.limit);

    if (this.onViolation) {
      try {
        await this.onViolation({
          limitType: violation.limitType,
          usage: violation.usage,
          limit: violation.limit,
          totalUsage: usage,
          scope: this.scope,
          scopeKey,
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
        limit: this.limits,
        scope: this.scope,
        scopeKey,
      },
    });
  }
}
