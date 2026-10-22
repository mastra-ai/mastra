import type { MastraDBMessage } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import { EntityType, getOrCreateSpan, SpanType } from '../observability';
import type { ToolCallGuardAttributes, TracingContext } from '../observability';
import { RequestContext } from '../request-context';
import type { Workspace } from '../workspace/workspace';
import type { ToolCallGuard, ToolCallGuardOptions, ToolCallGuardVerdict } from './types';

const TOOL_CALL_GUARD = Symbol.for('mastra.tool.callGuard');

const DEFAULT_MAX_CONSECUTIVE_DENIALS = 3;
const DEFAULT_MAX_TOTAL_DENIALS = 20;

/**
 * A `guardToolCall` hook plus the denial counters it accumulates over one run. One state is
 * shared by every tool converted for the run, so denials of different tools count together.
 */
export interface ToolCallGuardState {
  guard: ToolCallGuard;
  options?: ToolCallGuardOptions;
  declines: { consecutive: number; total: number };
}

/** Verdict the runtime acts on, after escalation. */
export type ResolvedToolCallGuardVerdict = ToolCallGuardVerdict & {
  /** True when the guard said `deny` but the denial threshold turned it into `ask`. */
  escalated?: boolean;
};

export function createToolCallGuardState(guard: ToolCallGuard, options?: ToolCallGuardOptions): ToolCallGuardState {
  return { guard, options, declines: { consecutive: 0, total: 0 } };
}

export function attachToolCallGuard(tool: object, state: ToolCallGuardState): void {
  Object.defineProperty(tool, TOOL_CALL_GUARD, { value: state, enumerable: false, configurable: true });
}

export function getToolCallGuardState(tool: unknown): ToolCallGuardState | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined;
  return (tool as Record<symbol, ToolCallGuardState | undefined>)[TOOL_CALL_GUARD];
}

export function hasToolCallGuard(tool: unknown): boolean {
  return getToolCallGuardState(tool) !== undefined;
}

function normalizeVerdict(verdict: unknown): ToolCallGuardVerdict | undefined {
  if (!verdict || typeof verdict !== 'object') return undefined;
  const { action, reason } = verdict as { action?: unknown; reason?: unknown };
  if (action === 'allow' || action === 'ask') return { action };
  if (action === 'deny') {
    return { action, reason: typeof reason === 'string' && reason ? reason : 'Tool call denied by guard' };
  }
  return undefined;
}

/**
 * Runs the guard for one tool call and updates the run's denial counters.
 *
 * A guard that throws or returns something other than a verdict yields `ask`, so a broken
 * guard falls back to a person rather than silently running or blocking the call. Once the
 * run reaches the configured consecutive or total denial count, a further `deny` becomes
 * `ask` (`escalated: true`).
 */
export async function evaluateToolCallGuard({
  state,
  toolName,
  toolCallId,
  args,
  messages,
  requestContext,
  workspace,
  logger,
}: {
  state: ToolCallGuardState;
  toolName: string;
  toolCallId: string;
  args: unknown;
  messages: MastraDBMessage[];
  requestContext?: RequestContext;
  workspace?: Workspace;
  logger?: IMastraLogger;
}): Promise<ResolvedToolCallGuardVerdict> {
  const { guard, options, declines } = state;

  let verdict: ToolCallGuardVerdict | undefined;
  try {
    verdict = normalizeVerdict(
      await guard({
        toolName,
        toolCallId,
        args,
        userMessages: messages.filter(message => message.role === 'user'),
        ...(options?.includeUntrustedContext ? { messages } : {}),
        requestContext: requestContext ?? new RequestContext(),
        workspace,
        declines: { ...declines },
      }),
    );
    if (!verdict) logger?.error(`guardToolCall returned an invalid verdict for tool ${toolName}; asking for approval`);
  } catch (error) {
    logger?.error(`Error calling guardToolCall for tool ${toolName}; asking for approval:`, error);
  }

  if (verdict?.action === 'allow') {
    declines.consecutive = 0;
    return verdict;
  }
  if (verdict?.action !== 'deny') {
    declines.consecutive = 0;
    return { action: 'ask' };
  }

  const maxConsecutive = options?.escalation?.consecutive ?? DEFAULT_MAX_CONSECUTIVE_DENIALS;
  const maxTotal = options?.escalation?.total ?? DEFAULT_MAX_TOTAL_DENIALS;
  if (declines.consecutive >= maxConsecutive || declines.total >= maxTotal) {
    declines.consecutive = 0;
    return { action: 'ask', escalated: true };
  }

  declines.consecutive++;
  declines.total++;
  return verdict;
}

/** Span attributes describing a guard verdict. */
export function toolCallGuardAttributes(verdict: ResolvedToolCallGuardVerdict): ToolCallGuardAttributes {
  return {
    action: verdict.action,
    ...(verdict.action === 'deny' ? { reason: verdict.reason } : {}),
    ...(verdict.escalated ? { escalated: true } : {}),
  };
}

/**
 * Records a TOOL_CALL span for a call the guard stopped (`deny`) or sent to approval (`ask`).
 * The tool never executes at this point, so the tool builder never opens its own span.
 */
export function recordToolCallGuardSpan({
  toolName,
  toolCallId,
  args,
  verdict,
  tracingContext,
  requestContext,
}: {
  toolName: string;
  toolCallId: string;
  args: unknown;
  verdict: ResolvedToolCallGuardVerdict;
  tracingContext?: TracingContext;
  requestContext?: RequestContext;
}): void {
  const span = getOrCreateSpan({
    type: SpanType.TOOL_CALL,
    name: `tool: '${toolName}'`,
    input: args,
    entityType: EntityType.TOOL,
    entityId: toolName,
    entityName: toolName,
    attributes: { toolType: 'tool', toolCallId, guard: toolCallGuardAttributes(verdict) },
    tracingPolicy: tracingContext?.currentSpan?.tracingPolicy,
    tracingContext,
    requestContext,
  });
  // `ask` hands the call to approval; if approved it runs later under its own span.
  span?.end(verdict.action === 'deny' ? { attributes: { success: false } } : {});
}
