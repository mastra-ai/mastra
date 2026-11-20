import type { MastraToolInvocation } from '../state/types';

type ToolInvocationState = MastraToolInvocation['state'];

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
