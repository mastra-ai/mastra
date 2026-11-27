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
