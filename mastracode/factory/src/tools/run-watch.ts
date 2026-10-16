import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import { FACTORY_TRANSITION_APPROVAL_KIND } from '../rules/tools.js';
import { FACTORY_OPEN_RUN_STALE_MS, heartbeatSessionOpenRun, type RunEndCaptureSession } from '../session/run-audit.js';
import type { FactoryRunOutcome } from './reports.js';

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];

/** What a run stopped on: a tool waiting for an answer, or one waiting for approval. */
export interface ParkedTool {
  toolName: string;
  toolCallId: string;
  approval: boolean;
}

export interface RunReportSession {
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

/** Reports one run's end; `since` is when the run's window opened. Should not throw. */
export type SessionRunEndReport = (outcome: FactoryRunOutcome, since: Date) => Promise<void>;

/** Told when the run holds a tool call for approval; the run stays open meanwhile. */
export type SessionApprovalReport = (request: { toolName: string; toolCallId: string; args: unknown }) => Promise<void>;

/** How much of a run's error message a `failed` report quotes. */
const ERROR_MESSAGE_LENGTH = 400;

/**
 * Report every run end of a session, however the run started: the board, a
 * typed message, a wake, or a run after a restart. Attached to each Factory
 * session when it is created, so it outlives any one start. A run someone
 * stopped or steered says nothing, and its window carries into the next run,
 * so reports the agent made in it still count.
 */
export function observeSessionRunReports(
  session: RunReportSession,
  report: SessionRunEndReport,
  { onApprovalRequested }: { onApprovalRequested?: SessionApprovalReport } = {},
): () => void {
  let parked: ParkedTool | undefined;
  let lastError: string | undefined;
  let since = new Date();
  const settle = (work: Promise<void>) =>
    void work.catch(error => {
      console.warn('[Factory reports] Unable to report on a session run.', error);
    });
  return session.subscribe(event => {
    if (event.type === 'tool_suspended' || event.type === 'tool_approval_required') {
      const approval = event.type === 'tool_approval_required' || isTransitionApproval(event.suspendPayload);
      parked = { toolName: event.toolName, toolCallId: event.toolCallId, approval };
      // Announced the moment it is asked, so whoever follows the work can answer it.
      if (approval && onApprovalRequested) {
        const args = event.type === 'tool_approval_required' ? event.args : event.suspendPayload;
        settle(onApprovalRequested({ toolName: event.toolName, toolCallId: event.toolCallId, args }));
      }
      return;
    }
    if (event.type === 'error') {
      lastError = event.error?.message;
      return;
    }
    if (event.type === 'tool_suspension_cancelled' && parked?.toolCallId === event.toolCallId) {
      parked = undefined;
      return;
    }
    if (event.type !== 'agent_end') return;
    const outcome = runOutcome(event.reason, parked, lastError);
    // A run paused for approval was already announced; the answer starts the next run.
    const announced = event.reason === 'suspended' && parked?.approval === true && onApprovalRequested !== undefined;
    parked = undefined;
    lastError = undefined;
    if (!outcome || announced) return;
    // Move the window now, so a run that starts before this report settles is judged on its own;
    // reports made up to the end, including its last millisecond, belong to the run that ended.
    const runSince = since;
    since = new Date(Date.now() + 1);
    settle(report(outcome, runSince));
  });
}

/**
 * Renew a kicked-off run's open-run entry until the run ends, like the
 * dispatcher's heartbeat, so no dispatcher starts the role again meanwhile.
 * `endReason` is how that run ended, once it has; `stop` is for a kickoff that fails.
 */
export function heartbeatOpenRunUntilEnd(
  session: RunEndCaptureSession,
  kickoffId: string,
): { endReason: () => RunEndReason; stop: () => void } {
  let endReason: RunEndReason;
  let unsubscribe = () => {};
  const timer = setInterval(
    () => void heartbeatSessionOpenRun(session, kickoffId),
    Math.floor(FACTORY_OPEN_RUN_STALE_MS / 3),
  );
  timer.unref?.();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    unsubscribe();
  };
  unsubscribe = session.subscribe(event => {
    if (event.type !== 'agent_end') return;
    endReason ??= event.reason;
    stop();
  });
  return { endReason: () => endReason, stop };
}

function isTransitionApproval(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === FACTORY_TRANSITION_APPROVAL_KIND
  );
}

/** `null` for an aborted run: someone stopped or steered it, which is not an outcome. */
export function runOutcome(
  reason: RunEndReason,
  parked: Pick<ParkedTool, 'toolName' | 'approval'> | undefined,
  errorMessage?: string,
): FactoryRunOutcome | null {
  switch (reason) {
    case 'error': {
      const message = errorMessage?.trim();
      return {
        status: 'failed',
        reason: message
          ? `the run ended in error: ${message.slice(0, ERROR_MESSAGE_LENGTH)}`
          : 'the run ended in error.',
      };
    }
    case 'aborted':
      return null;
    case 'suspended':
      return {
        status: 'blocked',
        ...(parked ? { toolName: parked.toolName, ...(parked.approval ? { approval: true } : {}) } : {}),
      };
    default:
      return { status: 'done' };
  }
}
