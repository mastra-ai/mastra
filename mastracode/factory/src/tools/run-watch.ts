import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import { FACTORY_OPEN_RUN_STALE_MS, heartbeatSessionOpenRun, type RunEndCaptureSession } from '../session/run-audit.js';
import type { FactoryRunEndResult, FactoryRunOutcome } from './reports.js';

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];

/** How long a spawned session is watched for a final report before the watch gives up. */
const SPAWNED_SESSION_WATCH_MS = 24 * 60 * 60 * 1000;

/**
 * Watch a session's runs until its work reaches a final outcome, so its
 * followers hear once. Renews the kicked-off run's open-run entry until that run
 * ends, like the dispatcher's heartbeat. A run that was aborted (stopped or
 * steered), or that ended waiting for an answer, hands over to the next run;
 * the watch ends at a final report, at `close()`, or after a day.
 */
export function watchStartedRun(
  session: RunEndCaptureSession,
  {
    kickoffId,
    onEnd,
    onClose,
  }: {
    kickoffId?: string;
    onEnd: (outcome: FactoryRunOutcome, since: Date) => Promise<FactoryRunEndResult>;
    /** Called once when the watch ends, however it ends. */
    onClose?: () => void;
  },
) {
  let firstEndReason: RunEndReason | undefined;
  let parked: { toolName: string; toolCallId: string } | undefined;
  let since = new Date();
  const timer =
    kickoffId === undefined
      ? undefined
      : setInterval(() => void heartbeatSessionOpenRun(session, kickoffId), Math.floor(FACTORY_OPEN_RUN_STALE_MS / 3));
  timer?.unref?.();
  const lifetime = setTimeout(() => close(), SPAWNED_SESSION_WATCH_MS);
  lifetime.unref?.();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    onClose?.();
    clearInterval(timer);
    clearTimeout(lifetime);
    unsubscribe();
  };
  const unsubscribe = session.subscribe(event => {
    if (event.type === 'tool_suspended') {
      parked = { toolName: event.toolName, toolCallId: event.toolCallId };
      return;
    }
    if (event.type === 'tool_suspension_cancelled' && parked?.toolCallId === event.toolCallId) {
      parked = undefined;
      return;
    }
    if (event.type !== 'agent_end') return;
    firstEndReason ??= event.reason;
    clearInterval(timer);
    const outcome = runOutcome(event.reason, parked?.toolName);
    parked = undefined;
    if (!outcome) return;
    // Move the window now, so a run that starts before this report settles is judged on its own;
    // reports made up to the end, including its last millisecond, belong to the run that ended.
    const runSince = since;
    since = new Date(Date.now() + 1);
    void onEnd(outcome, runSince).then(
      result => {
        if (!result.waiting) close();
      },
      () => close(),
    );
  });
  return { endReason: () => firstEndReason, close };
}

/** `null` for an aborted run: someone stopped or steered it, which is not a final outcome. */
export function runOutcome(reason: RunEndReason, parkedTool: string | undefined): FactoryRunOutcome | null {
  switch (reason) {
    case 'error':
      return { status: 'failed', reason: 'the run ended in error.' };
    case 'aborted':
      return null;
    case 'suspended':
      return { status: 'blocked', ...(parkedTool ? { toolName: parkedTool } : {}) };
    default:
      return { status: 'done' };
  }
}
