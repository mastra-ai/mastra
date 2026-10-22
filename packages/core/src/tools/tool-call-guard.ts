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

/** Key under which the guard's counters are saved in a tool-call suspend payload. */
export const TOOL_CALL_GUARD_SUSPEND_KEY = '__toolCallGuard';

export type ToolCallGuardDeclines = { consecutive: number; total: number };

/**
 * Options and denial counters for one run. Shared by every tool converted for the run, so
 * denials from the agent guard and from tool guards count together.
 */
export interface ToolCallGuardRun {
  options?: ToolCallGuardOptions;
  declines: ToolCallGuardDeclines;
}

/** Guards that decide calls to one tool, plus the run they count against. */
export interface ToolCallGuardState {
  /** The agent's `guardToolCall` hook. */
  agentGuard?: ToolCallGuard;
  /** The tool's own `guard`. */
  toolGuard?: ToolCallGuard;
  run: ToolCallGuardRun;
}

export type ToolCallGuardSource = 'agent' | 'tool';

/** Verdict the runtime acts on, after escalation. */
export type ResolvedToolCallGuardVerdict = ToolCallGuardVerdict & {
  /** Which guard produced the verdict. */
  decidedBy: ToolCallGuardSource;
  /** True when the guard said `deny` but the denial threshold turned it into `ask`. */
  escalated?: boolean;
};

export function createToolCallGuardRun(options?: ToolCallGuardOptions): ToolCallGuardRun {
  return { options, declines: { consecutive: 0, total: 0 } };
}

export function attachToolCallGuard(tool: object, state: ToolCallGuardState): void {
  Object.defineProperty(tool, TOOL_CALL_GUARD, { value: state, enumerable: false, configurable: true });
}

export function getToolCallGuardState(tool: unknown): ToolCallGuardState | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined;
  return (tool as Record<symbol, ToolCallGuardState | undefined>)[TOOL_CALL_GUARD];
}

/** True when an agent or tool guard decides calls to this tool. */
export function hasToolCallGuard(tool: unknown): boolean {
  const state = getToolCallGuardState(tool);
  return !!(state?.agentGuard || state?.toolGuard);
}

/** Reads a tool's own `guard` function, if present. */
export function getToolGuardFn(tool: unknown): ToolCallGuard | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined;
  const fn = (tool as { guard?: unknown }).guard;
  return typeof fn === 'function' ? (fn as ToolCallGuard) : undefined;
}

/** The run's guard state, read from any guarded tool in the step's tool set. */
export function findToolCallGuardRun(tools: Record<string, unknown> | undefined): ToolCallGuardRun | undefined {
  for (const tool of Object.values(tools ?? {})) {
    const run = getToolCallGuardState(tool)?.run;
    if (run) return run;
  }
  return undefined;
}

/**
 * Suspend-payload entry that carries the run's denial counters across a suspend/resume, and
 * whether the suspension is a guard `ask` (so a human's answer resets the consecutive count).
 */
export function toolCallGuardSuspendEntry(
  run: ToolCallGuardRun | undefined,
  verdict?: ResolvedToolCallGuardVerdict,
): Record<string, unknown> {
  if (!run) return {};
  return {
    [TOOL_CALL_GUARD_SUSPEND_KEY]: {
      declines: { ...run.declines },
      ...(verdict?.action === 'ask' ? { asked: true } : {}),
    },
  };
}

/**
 * Restores the counters a suspend payload saved into the resumed run. When the suspension was
 * a guard `ask` and a person answered it, the consecutive count resets; the total never does.
 */
export function restoreToolCallGuardFromSuspend(
  run: ToolCallGuardRun | undefined,
  suspendData: unknown,
  humanAnswered: boolean,
): void {
  if (!run || !suspendData || typeof suspendData !== 'object') return;
  const saved = (suspendData as Record<string, unknown>)[TOOL_CALL_GUARD_SUSPEND_KEY] as
    | { declines?: Partial<ToolCallGuardDeclines>; asked?: boolean }
    | undefined;
  const consecutive = saved?.declines?.consecutive;
  const total = saved?.declines?.total;
  if (typeof consecutive !== 'number' || typeof total !== 'number') return;
  const { declines } = run;
  // Several calls of one step can resume in turn; never move the counters backwards.
  if (total >= declines.total) {
    declines.total = total;
    declines.consecutive = consecutive;
  }
  if (saved?.asked && humanAnswered) declines.consecutive = 0;
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
 * Runs the guards for one tool call and updates the run's denial counters.
 *
 * The agent guard decides first; a `deny` or `ask` from it is final. The tool's own guard then
 * decides calls the agent guard allowed. A guard that throws or returns something other than a
 * verdict yields `ask`, so a broken guard falls back to a person rather than silently running
 * or blocking the call. Once the run reaches the configured consecutive or total denial count,
 * a further `deny` becomes `ask` (`escalated: true`). Returns undefined when no guard applies.
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
  state: ToolCallGuardState | undefined;
  toolName: string;
  toolCallId: string;
  args: unknown;
  messages: MastraDBMessage[];
  requestContext?: RequestContext;
  workspace?: Workspace;
  logger?: IMastraLogger;
}): Promise<ResolvedToolCallGuardVerdict | undefined> {
  if (!state || (!state.agentGuard && !state.toolGuard)) return undefined;
  const { options, declines } = state.run;

  const runGuard = async (guard: ToolCallGuard, source: ToolCallGuardSource): Promise<ToolCallGuardVerdict> => {
    const label = source === 'agent' ? 'guardToolCall' : `guard of tool ${toolName}`;
    try {
      const verdict = normalizeVerdict(
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
      if (verdict) return verdict;
      logger?.error(`${label} returned an invalid verdict for tool ${toolName}; asking for approval`);
    } catch (error) {
      logger?.error(`Error calling ${label} for tool ${toolName}; asking for approval:`, error);
    }
    return { action: 'ask' };
  };

  let verdict: ToolCallGuardVerdict = { action: 'allow' };
  let decidedBy: ToolCallGuardSource = 'agent';
  if (state.agentGuard) verdict = await runGuard(state.agentGuard, 'agent');
  if (verdict.action === 'allow' && state.toolGuard) {
    verdict = await runGuard(state.toolGuard, 'tool');
    decidedBy = 'tool';
  }

  if (verdict.action === 'allow') {
    declines.consecutive = 0;
    return { ...verdict, decidedBy };
  }
  // `ask` leaves the counters alone; the consecutive count resets once a person answers.
  if (verdict.action === 'ask') return { action: 'ask', decidedBy };

  const maxConsecutive = options?.escalation?.consecutive ?? DEFAULT_MAX_CONSECUTIVE_DENIALS;
  const maxTotal = options?.escalation?.total ?? DEFAULT_MAX_TOTAL_DENIALS;
  if (declines.consecutive >= maxConsecutive || declines.total >= maxTotal) {
    return { action: 'ask', decidedBy, escalated: true };
  }

  declines.consecutive++;
  declines.total++;
  return { ...verdict, decidedBy };
}

/** Span attributes describing a guard verdict. */
export function toolCallGuardAttributes(verdict: ResolvedToolCallGuardVerdict): ToolCallGuardAttributes {
  return {
    action: verdict.action,
    decidedBy: verdict.decidedBy,
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
