import { deepEqual } from '../../../utils/deep-equal';
import type { MastraToolInvocation } from '../state/types';

type ToolInvocationState = MastraToolInvocation['state'];

/**
 * Whether a copy of a call carries the arguments that identify it. An absent, empty, or primitive
 * argument record says only "this call had no arguments", which every such call shares.
 */
export function carriesToolCallArgs(args: unknown): boolean {
  if (args == null) return false;
  if (Array.isArray(args)) return args.length > 0;
  if (typeof args === 'object') return Object.keys(args).length > 0;
  return true;
}

/**
 * Whether `other` describes the call named by `toolCallId` and `args`.
 *
 * A toolCallId is not unique: providers restart numbering every step, so a later step of the same
 * run can reuse an id an earlier step already finished, and memory-backed threads see the same ids
 * again on later turns (#31609). A call's arguments are what tell one occurrence from another, so
 * copies agree only when their ids match and neither side carries arguments the other contradicts.
 * Copies with no arguments to compare fall back to the id alone.
 *
 * Used where only the loose pieces of a call (its id and arguments) are at hand, such as routing a
 * tool result read back from the message list, which holds no full invocation for the call yet.
 */
export function isSameToolCall(toolCallId: string, args: unknown, other: MastraToolInvocation): boolean {
  if (other.toolCallId !== toolCallId) return false;
  if (!carriesToolCallArgs(args) || !carriesToolCallArgs(other.args)) return true;
  return deepEqual(args, other.args);
}

/** Whether two copies of a tool invocation describe the same call. */
export function isSameToolInvocation(a: MastraToolInvocation, b: MastraToolInvocation): boolean {
  return isSameToolCall(a.toolCallId, a.args, b);
}

/** Argument keys the model never writes: Mastra strips them before a call runs. */
const INTERNAL_TOOL_ARG_KEYS: readonly string[] = ['_background'];

/** `args` without the internal keys, returning the original record when it holds none. */
function withoutInternalToolArgs(args: unknown): unknown {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return args;
  const record = args as Record<string, unknown>;
  if (!INTERNAL_TOOL_ARG_KEYS.some(key => key in record)) return args;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!INTERNAL_TOOL_ARG_KEYS.includes(key)) rest[key] = value;
  }
  return rest;
}

/**
 * Whether two copies of a call describe the same invocation once Mastra's internal argument keys
 * are set aside.
 *
 * A background dispatch's stored copy keeps the arguments the model produced, `_background`
 * included, while the outcome that later closes the call arrives without it (the fork strips that
 * key before a tool runs, see `applyBackgroundToolResult`). An exact comparison would then miss the
 * copy waiting for this outcome and could fold the result into a finished occurrence that shares
 * only the id and the remaining arguments. The read-back matcher sets the same keys aside
 * (`toolResultArgsMatch`), so the write path compares the same way.
 */
export function isSameToolInvocationIgnoringInternalArgs(a: MastraToolInvocation, b: MastraToolInvocation): boolean {
  return isSameToolCall(a.toolCallId, withoutInternalToolArgs(a.args), {
    ...b,
    args: withoutInternalToolArgs(b.args),
  });
}

/**
 * Whether `incoming` is a copy of a call the message already stores, rather than a new invocation
 * that happens to reuse the same id (and even the same arguments).
 *
 * A toolCallId identifies a call only within one response (#31609): a later step of the same run may
 * reuse both the id and the arguments for a genuinely new call. The merge decides that from position
 * and time rather than content — the caller passes `incomingOpensNewOccurrence` when the part arrives
 * on a newer response and a step-start already stored after the occurrence shows its step has ended.
 * The runtime re-adds accumulated parts without either, so a replay stays a copy.
 */
export function isStoredCopyOfInvocation(
  stored: { toolInvocation: MastraToolInvocation },
  incoming: { toolInvocation: MastraToolInvocation },
  incomingOpensNewOccurrence: boolean,
): boolean {
  if (!isSameToolInvocation(stored.toolInvocation, incoming.toolInvocation)) return false;
  return !incomingOpensNewOccurrence;
}

// How far a tool invocation has progressed. A tool part may only be moved forward by a later copy
// of the same call; a copy at the same or an earlier stage never overwrites what is stored.
const TOOL_INVOCATION_STATE_RANK: Record<ToolInvocationState, number> = {
  'partial-call': 0,
  call: 1,
  'approval-requested': 2,
  // Still pending: the approval was answered, but the tool has not produced its outcome yet.
  'approval-responded': 3,
  result: 4,
  'output-error': 4,
  'output-denied': 4,
};

export function isTerminalToolInvocationState(state: ToolInvocationState): boolean {
  return TOOL_INVOCATION_STATE_RANK[state] === TOOL_INVOCATION_STATE_RANK.result;
}

/** States a client can contribute for a call the server left pending: an approval answer or an outcome. */
export function isClientToolInvocationUpdate(state: ToolInvocationState): boolean {
  return state === 'approval-responded' || isTerminalToolInvocationState(state);
}

/** Whether `incoming` moves a stored tool invocation in state `stored` forward. */
export function advancesToolInvocationState(stored: ToolInvocationState, incoming: ToolInvocationState): boolean {
  return (
    !isTerminalToolInvocationState(stored) && TOOL_INVOCATION_STATE_RANK[incoming] > TOOL_INVOCATION_STATE_RANK[stored]
  );
}
