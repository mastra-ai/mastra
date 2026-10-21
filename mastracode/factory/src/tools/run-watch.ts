import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import { FACTORY_OPEN_RUN_STALE_MS, heartbeatSessionOpenRun } from '../session/run-audit.js';
import type { RunEndCaptureSession } from '../session/run-audit.js';
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
 * A usage or quota rejection, not a rate limit or a request-size limit. The
 * wording is the same set account rotation uses, so a provider that reports
 * the cap as a plain 400 still counts.
 */
const USAGE_LIMIT_MESSAGE_PATTERN =
  /usage limit|usage cap|insufficient_quota|quota exceeded|quota exhausted|quota reached|exceeded your current quota|insufficient balance|insufficient credits|credits exhausted|rate limit exceeded|rate limit reached|weekly limit|monthly limit/i;

const ERROR_CHAIN_DEPTH = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The provider's own usage-limit text, when the error chain carries one. Status text alone is not enough. */
export function usageLimitReason(error: unknown): string | undefined {
  const visited = new Set<object>();
  const found: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (text && USAGE_LIMIT_MESSAGE_PATTERN.test(text)) found.push(text);
  };

  function walk(value: unknown, depth: number) {
    if (depth > ERROR_CHAIN_DEPTH || !isRecord(value) || visited.has(value)) return;
    visited.add(value);
    add(value.message);
    if (typeof value.responseBody === 'string') {
      try {
        const body: unknown = JSON.parse(value.responseBody);
        if (isRecord(body)) {
          add(body.message);
          add(body.detail);
          if (isRecord(body.error)) add(body.error.message);
          else add(body.error);
        }
      } catch {
        // A non-JSON body can echo the request. Leave it out.
      }
    }
    if (value.cause !== undefined) walk(value.cause, depth + 1);
    if (value.error !== undefined) walk(value.error, depth + 1);
  }

  try {
    walk(error, 0);
  } catch {
    // A malformed error object still reports whatever was already found.
  }
  const reason = found.find(text => text !== 'Bad Request') ?? found[0];
  return reason?.slice(0, ERROR_MESSAGE_LENGTH);
}

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
      parked = {
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        approval: event.type === 'tool_approval_required',
      };
      // An approval gate holds the run open, so it is announced now, not at the run's end.
      if (event.type === 'tool_approval_required' && onApprovalRequested) {
        settle(onApprovalRequested({ toolName: event.toolName, toolCallId: event.toolCallId, args: event.args }));
      }
      return;
    }
    if (event.type === 'error') {
      const quota = usageLimitReason(event.error);
      lastError = quota ?? event.error?.message;
      return;
    }
    if (event.type === 'tool_suspension_cancelled' && parked?.toolCallId === event.toolCallId) {
      parked = undefined;
      return;
    }
    if (event.type !== 'agent_end') return;
    const outcome = runOutcome(event.reason, parked, lastError);
    parked = undefined;
    lastError = undefined;
    if (!outcome) return;
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
