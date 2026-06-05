import type { IMastraLogger } from '../logger';
import type { RequestContext } from '../request-context';

export type ToolGovernanceAction = 'allow' | 'deny';
export type ToolGovernanceAuditStatus = 'allowed' | 'blocked' | 'completed' | 'failed' | 'skipped';
export type ToolGovernanceSource = 'agent' | 'workflow' | 'durable-agent';
export type ToolGovernanceScope = 'global' | 'agent' | 'workflow' | 'run' | 'resource' | 'thread' | 'tool';

export interface ToolGovernancePolicyContext {
  toolCallId: string;
  toolName: string;
  args: unknown;
  runId: string;
  agentId?: string;
  workflowId?: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext | Map<string, unknown>;
  source: ToolGovernanceSource;
  tool?: unknown;
}

export type ToolGovernancePolicyDecision =
  | boolean
  | {
      action?: ToolGovernanceAction;
      allowed?: boolean;
      reason?: string;
      cost?: number;
      metadata?: Record<string, unknown>;
    };

export type ToolGovernancePolicy = (
  context: ToolGovernancePolicyContext,
) => ToolGovernancePolicyDecision | Promise<ToolGovernancePolicyDecision>;

export interface ToolGovernanceBudget {
  /** Maximum cumulative estimated cost allowed for this budget. */
  limit: number;
  /** Scope used for tracking cumulative usage. Defaults to run. */
  scope?: ToolGovernanceScope;
  /** Restrict this budget to a single tool name. */
  toolName?: string;
  /** Whether exceeding the budget should block execution or only audit a warning. Defaults to block. */
  action?: 'block' | 'warn';
}

export type ToolCostEstimator = (context: ToolGovernancePolicyContext) => number | Promise<number>;

export interface ToolGovernanceCostOptions {
  /** Cost used when a tool-specific cost or estimator is not provided. Defaults to 0. */
  default?: number;
  /** Fixed estimated costs keyed by tool name. */
  tools?: Record<string, number>;
  /** Optional estimator for dynamic per-call costs. */
  estimate?: ToolCostEstimator;
}

export interface ToolGovernanceCircuitBreakerOptions {
  /** Number of failures that opens the circuit for a key. */
  failureThreshold: number;
  /** How long to keep the circuit open. Omit for an open circuit until the state is reset. */
  cooldownMs?: number;
  /** Scope used for breaker keys. Defaults to tool. */
  scope?: ToolGovernanceScope;
  /** Whether policy denials should count as failures. Defaults to false. */
  includePolicyDenials?: boolean;
}

export interface ToolGovernanceAuditEvent {
  timestamp: string;
  status: ToolGovernanceAuditStatus;
  action: ToolGovernanceAction;
  reason?: string;
  toolCallId: string;
  toolName: string;
  runId: string;
  agentId?: string;
  workflowId?: string;
  resourceId?: string;
  threadId?: string;
  source: ToolGovernanceSource;
  estimatedCost?: number;
  budgets?: Array<{
    scope: ToolGovernanceScope;
    key: string;
    limit: number;
    used: number;
    remaining: number;
    action: 'block' | 'warn';
  }>;
  circuitBreaker?: {
    key: string;
    failures: number;
    openUntil?: number;
  };
  metadata?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
  };
}

export interface ToolGovernanceOptions {
  /** Exact tool names that may execute. If omitted, all tools are candidates unless denied. */
  allowlist?: string[];
  /** Exact tool names that must never execute. Denylists take precedence over allowlists. */
  denylist?: string[];
  /** Additional policies evaluated in array order after allowlist/denylist checks. */
  policies?: ToolGovernancePolicy[];
  /** Estimated tool costs used for audit and budget enforcement. */
  costs?: ToolGovernanceCostOptions;
  /** One or more budgets evaluated before execution. */
  budget?: ToolGovernanceBudget | ToolGovernanceBudget[];
  /** Circuit breaker options for repeated tool failures. */
  circuitBreaker?: ToolGovernanceCircuitBreakerOptions;
  /** Callback for structured audit events. */
  onAudit?: (event: ToolGovernanceAuditEvent) => void | Promise<void>;
  /** Shared state for budget and circuit-breaker counters. */
  state?: ToolGovernanceState;
}

export interface ToolGovernanceEvaluation {
  allowed: boolean;
  reason?: string;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
  budgets?: ToolGovernanceAuditEvent['budgets'];
  circuitBreaker?: ToolGovernanceAuditEvent['circuitBreaker'];
}

type CircuitState = {
  failures: number;
  openUntil?: number;
};

const optionState = new WeakMap<ToolGovernanceOptions, ToolGovernanceState>();

export class ToolGovernanceError extends Error {
  constructor(
    message: string,
    public readonly decision: ToolGovernanceEvaluation,
  ) {
    super(message);
    this.name = 'ToolGovernanceError';
  }
}

export class ToolGovernanceState {
  #budgetUsage = new Map<string, number>();
  #circuits = new Map<string, CircuitState>();

  getBudgetUsage(key: string): number {
    return this.#budgetUsage.get(key) ?? 0;
  }

  addBudgetUsage(key: string, cost: number): number {
    const next = this.getBudgetUsage(key) + cost;
    this.#budgetUsage.set(key, next);
    return next;
  }

  getCircuit(key: string): CircuitState {
    return this.#circuits.get(key) ?? { failures: 0 };
  }

  recordCircuitSuccess(key: string): CircuitState {
    const next = { failures: 0 };
    this.#circuits.set(key, next);
    return next;
  }

  recordCircuitFailure(key: string, options: ToolGovernanceCircuitBreakerOptions, now = Date.now()): CircuitState {
    const current = this.getCircuit(key);
    const failures = current.failures + 1;
    const next: CircuitState = { failures };
    if (failures >= options.failureThreshold) {
      next.openUntil = options.cooldownMs === undefined ? Number.POSITIVE_INFINITY : now + options.cooldownMs;
    }
    this.#circuits.set(key, next);
    return next;
  }

  reset(): void {
    this.#budgetUsage.clear();
    this.#circuits.clear();
  }
}

export function getToolGovernanceState(options: ToolGovernanceOptions): ToolGovernanceState {
  if (options.state) {
    return options.state;
  }

  let state = optionState.get(options);
  if (!state) {
    state = new ToolGovernanceState();
    optionState.set(options, state);
  }
  return state;
}

export function createToolGovernanceError(decision: ToolGovernanceEvaluation, toolName: string): ToolGovernanceError {
  return new ToolGovernanceError(decision.reason ?? `Tool "${toolName}" was blocked by governance policy`, decision);
}

export async function evaluateToolGovernance(
  options: ToolGovernanceOptions | undefined,
  context: ToolGovernancePolicyContext,
  logger?: IMastraLogger,
): Promise<ToolGovernanceEvaluation | undefined> {
  if (!options) {
    return undefined;
  }

  const state = getToolGovernanceState(options);
  const metadata: Record<string, unknown> = {};
  const circuitKey = options.circuitBreaker ? getScopeKey(options.circuitBreaker.scope ?? 'tool', context) : undefined;

  if (options.circuitBreaker && circuitKey) {
    const circuit = state.getCircuit(circuitKey);
    if (isCircuitOpen(circuit)) {
      const evaluation = {
        allowed: false,
        reason: `Circuit breaker is open for ${circuitKey}`,
        estimatedCost: 0,
        circuitBreaker: { key: circuitKey, ...circuit },
      };
      await emitToolGovernanceAudit(options, context, evaluation, 'blocked', logger);
      return evaluation;
    }
  }

  if (options.denylist?.includes(context.toolName)) {
    const evaluation = { allowed: false, reason: `Tool "${context.toolName}" is denied`, estimatedCost: 0, metadata };
    await emitToolGovernanceAudit(options, context, evaluation, 'blocked', logger);
    recordPolicyDenial(options, state, circuitKey);
    return evaluation;
  }

  if (options.allowlist && !options.allowlist.includes(context.toolName)) {
    const evaluation = {
      allowed: false,
      reason: `Tool "${context.toolName}" is not in the allowlist`,
      estimatedCost: 0,
      metadata,
    };
    await emitToolGovernanceAudit(options, context, evaluation, 'blocked', logger);
    recordPolicyDenial(options, state, circuitKey);
    return evaluation;
  }

  let policyCost: number | undefined;
  for (const policy of options.policies ?? []) {
    const decision = normalizePolicyDecision(await policy(context));
    if (decision.metadata) {
      Object.assign(metadata, decision.metadata);
    }
    if (decision.cost !== undefined) {
      policyCost = decision.cost;
    }
    if (!decision.allowed) {
      const evaluation = {
        allowed: false,
        reason: decision.reason ?? `Tool "${context.toolName}" was denied by policy`,
        estimatedCost: policyCost ?? 0,
        metadata,
      };
      await emitToolGovernanceAudit(options, context, evaluation, 'blocked', logger);
      recordPolicyDenial(options, state, circuitKey);
      return evaluation;
    }
  }

  const estimatedCost = policyCost ?? (await estimateToolCost(options, context));
  const budgetResult = evaluateBudgets(options, context, state, estimatedCost);
  const evaluation = {
    allowed: budgetResult.allowed,
    reason: budgetResult.reason,
    estimatedCost,
    metadata: Object.keys(metadata).length ? metadata : undefined,
    budgets: budgetResult.budgets,
    circuitBreaker: circuitKey ? { key: circuitKey, ...state.getCircuit(circuitKey) } : undefined,
  };

  if (!evaluation.allowed) {
    await emitToolGovernanceAudit(options, context, evaluation, 'blocked', logger);
    recordPolicyDenial(options, state, circuitKey);
    return evaluation;
  }

  for (const budget of budgetResult.reservedBudgets) {
    state.addBudgetUsage(budget.key, estimatedCost);
  }

  await emitToolGovernanceAudit(options, context, evaluation, 'allowed', logger);
  return evaluation;
}

export async function recordToolGovernanceResult({
  options,
  context,
  evaluation,
  status,
  error,
  logger,
}: {
  options: ToolGovernanceOptions | undefined;
  context: ToolGovernancePolicyContext;
  evaluation: ToolGovernanceEvaluation | undefined;
  status: 'completed' | 'failed';
  error?: unknown;
  logger?: IMastraLogger;
}): Promise<void> {
  if (!options || !evaluation) {
    return;
  }

  const state = getToolGovernanceState(options);
  const circuitKey = options.circuitBreaker ? getScopeKey(options.circuitBreaker.scope ?? 'tool', context) : undefined;
  let circuitBreaker = evaluation.circuitBreaker;

  if (options.circuitBreaker && circuitKey) {
    const circuit =
      status === 'failed'
        ? state.recordCircuitFailure(circuitKey, options.circuitBreaker)
        : state.recordCircuitSuccess(circuitKey);
    circuitBreaker = { key: circuitKey, ...circuit };
  }

  await emitToolGovernanceAudit(
    options,
    context,
    {
      ...evaluation,
      allowed: status === 'completed',
      reason: status === 'failed' ? getErrorMessage(error) : evaluation.reason,
      circuitBreaker,
    },
    status,
    logger,
    error,
  );
}

export async function emitToolGovernanceSkipped(
  options: ToolGovernanceOptions | undefined,
  context: ToolGovernancePolicyContext,
  logger?: IMastraLogger,
): Promise<void> {
  if (!options) {
    return;
  }

  await emitToolGovernanceAudit(
    options,
    context,
    { allowed: true, estimatedCost: 0, reason: 'Tool execution was skipped' },
    'skipped',
    logger,
  );
}

async function emitToolGovernanceAudit(
  options: ToolGovernanceOptions,
  context: ToolGovernancePolicyContext,
  evaluation: ToolGovernanceEvaluation,
  status: ToolGovernanceAuditStatus,
  logger?: IMastraLogger,
  error?: unknown,
): Promise<void> {
  const event: ToolGovernanceAuditEvent = {
    timestamp: new Date().toISOString(),
    status,
    action: evaluation.allowed ? 'allow' : 'deny',
    reason: evaluation.reason,
    toolCallId: context.toolCallId,
    toolName: context.toolName,
    runId: context.runId,
    agentId: context.agentId,
    workflowId: context.workflowId,
    resourceId: context.resourceId,
    threadId: context.threadId,
    source: context.source,
    estimatedCost: evaluation.estimatedCost,
    budgets: evaluation.budgets,
    circuitBreaker: evaluation.circuitBreaker,
    metadata: evaluation.metadata,
    error: error ? normalizeError(error) : undefined,
  };

  logger?.info?.('[ToolGovernance] audit', event);
  try {
    await options.onAudit?.(event);
  } catch (auditError) {
    logger?.warn?.('[ToolGovernance] audit callback failed', auditError);
  }
}

function normalizePolicyDecision(decision: ToolGovernancePolicyDecision): {
  allowed: boolean;
  reason?: string;
  cost?: number;
  metadata?: Record<string, unknown>;
} {
  if (typeof decision === 'boolean') {
    return { allowed: decision };
  }

  const allowed = decision.allowed ?? decision.action !== 'deny';
  return {
    allowed,
    reason: decision.reason,
    cost: decision.cost,
    metadata: decision.metadata,
  };
}

async function estimateToolCost(options: ToolGovernanceOptions, context: ToolGovernancePolicyContext): Promise<number> {
  if (options.costs?.estimate) {
    return normalizeCost(await options.costs.estimate(context));
  }

  return normalizeCost(options.costs?.tools?.[context.toolName] ?? options.costs?.default ?? 0);
}

function evaluateBudgets(
  options: ToolGovernanceOptions,
  context: ToolGovernancePolicyContext,
  state: ToolGovernanceState,
  estimatedCost: number,
): {
  allowed: boolean;
  reason?: string;
  budgets: NonNullable<ToolGovernanceAuditEvent['budgets']>;
  reservedBudgets: Array<{ key: string }>;
} {
  const budgets = Array.isArray(options.budget) ? options.budget : options.budget ? [options.budget] : [];
  const auditBudgets: NonNullable<ToolGovernanceAuditEvent['budgets']> = [];
  const reservedBudgets: Array<{ key: string }> = [];

  for (const budget of budgets) {
    if (budget.toolName && budget.toolName !== context.toolName) {
      continue;
    }

    const scope = budget.scope ?? 'run';
    const key = getBudgetKey(scope, context, budget);
    const used = state.getBudgetUsage(key);
    const nextUsed = used + estimatedCost;
    const remaining = budget.limit - nextUsed;
    const action = budget.action ?? 'block';

    auditBudgets.push({
      scope,
      key,
      limit: budget.limit,
      used: nextUsed,
      remaining,
      action,
    });

    if (nextUsed > budget.limit && action === 'block') {
      return {
        allowed: false,
        reason: `Tool governance budget exceeded for ${key}`,
        budgets: auditBudgets,
        reservedBudgets,
      };
    }

    reservedBudgets.push({ key });
  }

  return { allowed: true, budgets: auditBudgets, reservedBudgets };
}

function getBudgetKey(scope: ToolGovernanceScope, context: ToolGovernancePolicyContext, budget: ToolGovernanceBudget) {
  const suffix = budget.toolName ? `:tool:${budget.toolName}` : '';
  return `${getScopeKey(scope, context)}${suffix}`;
}

function getScopeKey(scope: ToolGovernanceScope, context: ToolGovernancePolicyContext): string {
  switch (scope) {
    case 'agent':
      return `agent:${context.agentId ?? 'unknown'}`;
    case 'workflow':
      return `workflow:${context.workflowId ?? 'unknown'}`;
    case 'resource':
      return `resource:${context.resourceId ?? 'unknown'}`;
    case 'thread':
      return `thread:${context.threadId ?? 'unknown'}`;
    case 'tool':
      return `tool:${context.toolName}`;
    case 'global':
      return 'global';
    case 'run':
    default:
      return `run:${context.runId}`;
  }
}

function normalizeCost(cost: number): number {
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

function isCircuitOpen(circuit: CircuitState): boolean {
  if (!circuit.openUntil) {
    return false;
  }

  return circuit.openUntil === Number.POSITIVE_INFINITY || circuit.openUntil > Date.now();
}

function recordPolicyDenial(
  options: ToolGovernanceOptions,
  state: ToolGovernanceState,
  circuitKey: string | undefined,
) {
  if (!options.circuitBreaker?.includePolicyDenials || !circuitKey) {
    return;
  }

  state.recordCircuitFailure(circuitKey, options.circuitBreaker);
}

function normalizeError(error: unknown): ToolGovernanceAuditEvent['error'] {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: getErrorMessage(error) };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
