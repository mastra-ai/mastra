import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * How long a single `circle` invocation may take.
 *
 * Login talks to Circle twice — an OTP request, then an exchange — over links
 * this process does not control, so it is generous. It is still bounded: a
 * hung CLI holds an HTTP handler open, and a handler that never answers is
 * indistinguishable to the caller from one that failed.
 */
const TIMEOUT_MS = 60_000;

/** The CLI's own directory inside a caller's home. Mirrors the sandbox's. */
export const circleCliHome = (home: string) => join(home, '.circle-cli');

/**
 * The npm prefix a caller's own installs are pinned to.
 *
 * Nothing ships the Circle CLI: the agent installs it at runtime, following
 * Circle's setup document, with `npm install -g`. That writes to npm's prefix,
 * and on a deployed container the default prefix is a root-owned directory the
 * server cannot write to — so the sandbox pins the prefix here instead, under
 * the caller's own home, where the install can land and where a second caller's
 * install cannot overwrite it.
 *
 * Exported because two environments have to name the same directory: the shell
 * that runs the install, and this module, which has to find what it produced.
 */
export const cliPrefix = (home: string) => join(home, '.local');

/**
 * PATH with the caller's own installs ahead of whatever the server inherited.
 *
 * This is the one line that made the control plane work locally and fail
 * deployed. A developer already has `circle` on their machine's PATH, so the
 * server process inherits it and `execFile('circle')` finds it; a deployed
 * container has it nowhere but inside the caller's home, put there by the
 * agent, on a PATH no server process ever sees. The control plane would then
 * report NOT_INSTALLED for a binary sitting one directory away — and the agent,
 * told its acceptance had not been recorded, would fall back to running
 * `circle terms accept` itself and hit the block that exists to stop it.
 *
 * Prepended rather than substituted, so a CLI already on the machine still
 * resolves and a caller's own install wins where both exist.
 */
export const cliPath = (home: string) =>
  [join(cliPrefix(home), 'bin'), process.env.PATH]
    .filter((entry): entry is string => Boolean(entry))
    .join(delimiter);

/**
 * The environment a control-plane invocation runs under.
 *
 * Narrower than the sandbox's — no skills store, no working directory to speak
 * of, because these commands touch the CLI's own state and nothing else — but
 * it resolves `circle` to the same binary the agent's shell does. It has to:
 * the CLI is installed at runtime into the caller's home, so an environment
 * that does not look there cannot run the command this module exists to run.
 *
 * CIRCLE_ACCEPT_TERMS is absent here for the same reason it is absent from the
 * agent's sandbox, and the reason matters more here rather than less. This
 * module is the thing that runs `circle terms accept`, so it is the one place
 * where a stray "accept everything" default would turn a human's decision into
 * a config value nobody reads. Acceptance happens because a person asked for
 * it, on the request that carries their ask, or it does not happen.
 */
const cliEnv = (home: string): NodeJS.ProcessEnv => ({
  PATH: cliPath(home),
  HOME: home,
  USERPROFILE: home,
  CIRCLE_CLI_HOME: circleCliHome(home),
  NO_COLOR: '1',
  NODE_NO_WARNINGS: '1',
  ...(process.env.NODE_OPTIONS ? { NODE_OPTIONS: process.env.NODE_OPTIONS } : {}),
});

export type CliResult<T> = { ok: true; data: T } | { ok: false; message: string; code: string };

/** The `{ data }` / `{ error }` envelope every `--output json` command writes to stdout. */
type Envelope<T> = { data?: T; error?: { code?: string; message?: string; hint?: string } };

function parse<T>(stdout: string): Envelope<T> | undefined {
  const text = stdout.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    return undefined;
  }
}

/**
 * One `circle` command, with its JSON envelope unwrapped.
 *
 * The CLI reports a failure two ways at once — a non-zero exit *and* an
 * `{ error }` body — and the body is the useful half, so a throw is unwrapped
 * back into the same shape a clean run produces rather than propagated. What
 * the caller gets is a result to branch on; what it never gets is an exception
 * carrying a command line, which is how a request id or an OTP ends up in a
 * log.
 */
export async function circle<T>(home: string, args: string[]): Promise<CliResult<T>> {
  const argv = [...args, '--output', 'json'];

  try {
    const { stdout } = await run('circle', argv, {
      env: cliEnv(home),
      timeout: TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = parse<T>(stdout);

    if (parsed?.error) {
      return {
        ok: false,
        code: parsed.error.code ?? 'INTERNAL',
        message: parsed.error.message ?? 'The Circle CLI reported an error.',
      };
    }
    if (parsed && 'data' in parsed) return { ok: true, data: parsed.data as T };

    return { ok: false, code: 'INTERNAL', message: 'The Circle CLI returned no readable output.' };
  } catch (error) {
    const failed = error as { stdout?: string; code?: unknown; message?: string };
    const parsed = parse<T>(failed.stdout ?? '');

    if (parsed?.error) {
      return {
        ok: false,
        code: parsed.error.code ?? 'INTERNAL',
        message: parsed.error.message ?? 'The Circle CLI reported an error.',
      };
    }
    // `ENOENT` is the one worth naming: it means the binary is missing, which
    // on a deployed image is a build problem and not something a caller can
    // fix by trying again.
    if (failed.code === 'ENOENT') {
      return {
        ok: false,
        code: 'NOT_INSTALLED',
        message: 'The Circle CLI is not installed on the agent server.',
      };
    }

    return { ok: false, code: 'INTERNAL', message: 'The Circle CLI could not be run.' };
  }
}

/**
 * How long a `login-requests/<uuid>.json` file is worth reading.
 *
 * The CLI's own window, restated because the callers below pick the request to
 * complete and have to agree with the CLI about which ones are still live —
 * `loadLoginRequest` deletes anything older than this and reports it as
 * invalid, and offering the user a request the CLI will refuse is worse than
 * telling them up front that the code expired.
 */
const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;

/** What the CLI writes for a login it has started but not finished. */
type LoginRequest = {
  requestId?: unknown;
  email?: unknown;
  timestamp?: unknown;
  otpHead?: unknown;
};

/** The half of a login request that is safe to say out loud. */
export type PendingLogin = { requestId: string; email: string; otpHead?: string };

type TermsRecord = { accepted?: unknown; acceptedAt?: unknown; acceptedVia?: unknown };

/**
 * Terms acceptance, read from the file the CLI records it in.
 *
 * A fact about the filesystem rather than about the conversation, which is what
 * makes it answerable after a restart, in a new thread, or from whichever of
 * the two front doors — the control plane or the login tool — is asking.
 */
export async function termsAccepted(home: string): Promise<boolean> {
  try {
    const raw = await readFile(join(circleCliHome(home), 'terms.json'), 'utf-8');
    const record = JSON.parse(raw) as TermsRecord;

    return record.accepted === true;
  } catch {
    return false;
  }
}

/**
 * The most recent login this caller started and has not finished.
 *
 * Read from disk rather than held in memory, because the CLI already keeps it
 * there and a second copy is a second thing to get out of sync — and because
 * memory does not survive the restart that a login, sitting between two
 * requests a minute apart, very much can.
 *
 * Only three fields come back. The same file holds the device token and the
 * encryption key the OTP is exchanged against, and those have no reason to
 * exist anywhere but on disk.
 */
export async function pendingLogin(home: string): Promise<PendingLogin | undefined> {
  const dir = join(circleCliHome(home), 'login-requests');

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return undefined;
  }

  const live: (PendingLogin & { at: number })[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const request = JSON.parse(await readFile(join(dir, file), 'utf-8')) as LoginRequest;
      const at = typeof request.timestamp === 'number' ? request.timestamp : 0;

      if (typeof request.requestId !== 'string' || typeof request.email !== 'string') continue;
      if (Date.now() - at > LOGIN_REQUEST_TTL_MS) continue;

      live.push({
        at,
        requestId: request.requestId,
        email: request.email,
        ...(typeof request.otpHead === 'string' ? { otpHead: request.otpHead } : {}),
      });
    } catch {
      // A half-written or hand-edited file is not worth failing the whole
      // request over; the user's next code request writes a fresh one.
    }
  }

  live.sort((a, b) => b.at - a.at);

  return live[0];
}
