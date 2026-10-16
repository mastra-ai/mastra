import type { ActionDraft } from './to-actions';
import type { PersistableAction, ToolErrorCode } from './types';

export const TOOL_OUTCOME_UNKNOWN_TEXT =
  'The run was interrupted after this tool started, so its outcome is unknown. It may have run; do not assume it did or did not, and do not retry it without checking.';
export const TOOL_NOT_STARTED_TEXT = 'The run was interrupted before this tool started. It did not run.';
export const SUPERSEDED_APPROVAL_REASON = 'superseded by new input';

const OUTCOMES = new Set(['tool-result', 'tool-error', 'tool-denied']);
/**
 * Actions that mean a run is under way. One of these after a run's end means it was resumed; other rows a
 * run writes after its end (titles, memory and goal events, outcomes) leave it closed.
 */
const OPENING = new Set([
  'run-start',
  'turn-start',
  'text',
  'reasoning',
  'file',
  'tool-call',
  'tool-started',
  'tool-approval-responded',
]);

export type RepairCloser = { runId: string | undefined; action: ActionDraft };

/**
 * The closers that make a log a valid prompt again after a crash, abort or error. Pure: the caller stamps
 * ids (keeping each closer's `runId`) and saves them, so repairing a repaired log returns nothing.
 *
 * - A tool call with no outcome gets a `tool-error`: `TOOL_OUTCOME_UNKNOWN` when a `tool-started` was
 *   recorded (it may have run; never retried automatically), else `TOOL_NOT_STARTED`.
 * - A call waiting on an approval answer is suspended, not interrupted: it stays open when the incoming run
 *   resumes its run (`resumingRunId`), and otherwise gets a `tool-denied` ("superseded by new input"),
 *   because a provider rejects a tool call with no result.
 * - A run with no `run-end`/`run-aborted` after its last activity gets a `turn-end` (only if a `turn-start`
 *   is still open) and a `run-end`, both `interrupted`.
 * - Calls the incoming input answers (`answeredCallIds`: a client tool's outcome, an approval answer) are
 *   left for that input to close.
 */
export function repairOpenRun(
  log: PersistableAction[],
  options: { resumingRunId?: string; answeredCallIds?: ReadonlySet<string> } = {},
): RepairCloser[] {
  const calls = new Map<string, Extract<PersistableAction, { type: 'tool-call' }>>();
  const done = new Set<string>();
  const started = new Set<string>();
  const awaitingApproval = new Set<string>();
  const runs = new Map<string, { open: boolean; turnOpen: boolean }>();

  for (const a of log) {
    if (a.runId) {
      const run = runs.get(a.runId) ?? { open: false, turnOpen: false };
      runs.set(a.runId, run);
      if (a.type === 'run-end' || a.type === 'run-aborted') run.open = run.turnOpen = false;
      else if (OPENING.has(a.type)) run.open = true;
      if (a.type === 'turn-start') run.turnOpen = true;
      else if (a.type === 'turn-end') run.turnOpen = false;
    }
    if (a.type === 'tool-call') {
      if (!a.providerExecuted) calls.set(a.toolCallId, a);
    } else if (a.type === 'tool-started') started.add(a.toolCallId);
    else if (a.type === 'tool-approval-requested') awaitingApproval.add(a.toolCallId);
    else if (a.type === 'tool-approval-responded') awaitingApproval.delete(a.toolCallId);
    else if (OUTCOMES.has(a.type)) done.add((a as { toolCallId: string }).toolCallId);
  }

  const closers: RepairCloser[] = [];
  for (const call of calls.values()) {
    if (done.has(call.toolCallId) || options.answeredCallIds?.has(call.toolCallId)) continue;
    const ref = { toolCallId: call.toolCallId, toolName: call.toolName };
    if (awaitingApproval.has(call.toolCallId)) {
      if (options.resumingRunId === undefined || call.runId !== options.resumingRunId)
        closers.push({
          runId: call.runId,
          action: { type: 'tool-denied', ...ref, reason: SUPERSEDED_APPROVAL_REASON },
        });
      continue;
    }
    const code: ToolErrorCode = started.has(call.toolCallId) ? 'TOOL_OUTCOME_UNKNOWN' : 'TOOL_NOT_STARTED';
    closers.push({
      runId: call.runId,
      action: {
        type: 'tool-error',
        ...ref,
        code,
        errorText: code === 'TOOL_OUTCOME_UNKNOWN' ? TOOL_OUTCOME_UNKNOWN_TEXT : TOOL_NOT_STARTED_TEXT,
      },
    });
  }
  for (const [runId, run] of runs) {
    if (!run.open) continue;
    if (run.turnOpen) closers.push({ runId, action: { type: 'turn-end', finishReason: 'interrupted', usage: {} } });
    closers.push({ runId, action: { type: 'run-end', finishReason: 'interrupted', usage: {} } });
  }
  return closers;
}
