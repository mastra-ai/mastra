import { SetupCommandError } from '../integrations/github/sandbox.js';
import type {
  SessionSetupInProgress,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';

/**
 * Which setup command a session's sandbox is running, stored on the session
 * row so every process can tell the agent while it runs. Commands it sends
 * meanwhile can be slow or time out, even `echo ok`, which otherwise reads as
 * a dead sandbox.
 */
export type SetupInProgress = SessionSetupInProgress;

/** The target recorded for the environment's own setup command, which belongs to no repository. */
export const WORKSPACE_SETUP_TARGET = 'workspace';

type SetupStorage = Pick<SourceControlStorageHandle['sessions'], 'setSetupInProgress' | 'clearSetupInProgress'>;

function warnMarkFailed(action: string, sessionId: string, error: unknown): void {
  console.warn(`[Mastra Factory] Could not ${action} the setup-in-progress mark`, {
    sessionId,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Run a setup command, recording it on the session as in progress until it
 * settles. The mark's deadline bounds the command: `run` gets the time left
 * until it as the command's timeout, so however long the mark write took, the
 * command is stopped before the mark lapses; if the write used up the whole
 * limit, the command is not started and setup fails. The mark only informs the agent, so failing to write it never
 * stops setup, and clearing it leaves a later setup's mark alone.
 */
export async function trackSetup<T>(
  storage: SetupStorage,
  sessionId: string,
  target: string,
  limitMs: number,
  run: (timeoutMs: number) => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  const deadline = new Date(startedAt.getTime() + limitMs);
  await storage
    .setSetupInProgress({
      sessionId,
      setup: { target, startedAt, deadline },
    })
    .catch((error: unknown) => warnMarkFailed('write', sessionId, error));
  try {
    const timeoutMs = deadline.getTime() - Date.now();
    // The mark already lapsed: a command started now would run unannounced
    // and could be recreated away, so fail setup the way a timeout would.
    if (timeoutMs <= 0) {
      throw new SetupCommandError(
        `Setup for ${target} did not start: recording it used up its ${Math.round(limitMs / 1000)}s limit.`,
        'setup-failed',
      );
    }
    return await run(timeoutMs);
  } finally {
    await storage
      .clearSetupInProgress({ sessionId, startedAt })
      .catch((error: unknown) => warnMarkFailed('clear', sessionId, error));
  }
}

/**
 * The session's setup while it is running. A mark past its deadline is
 * ignored: the command was stopped by then, even if the process that ran it
 * died before clearing the mark.
 */
export function runningSetup(
  session: Pick<SourceControlSession, 'setupInProgress'> | null | undefined,
  now = Date.now(),
): SetupInProgress | undefined {
  const setup = session?.setupInProgress;
  return setup && setup.deadline.getTime() > now ? setup : undefined;
}

export function describeSetupInProgress(setup: SetupInProgress): string {
  const clock = (date: Date) => `${date.toISOString().slice(11, 16)} UTC`;
  return (
    `The sandbox is running ${setup.target === WORKSPACE_SETUP_TARGET ? "the environment's own setup command" : `the setup command for ${setup.target}`}, started at ${clock(setup.startedAt)} and stopped at ${clock(setup.deadline)} if still running. ` +
    "Until it ends, commands can be slow or time out, even `echo ok`: that is setup, not a broken sandbox, so don't recreate the sandbox. " +
    'Tell the person you are waiting for setup, then retry with a longer timeout.'
  );
}
