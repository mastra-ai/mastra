import type { SandboxInfo, WorkspaceSandbox } from '@mastra/core/workspace';

/** Directory name (under the sandbox user's home) that the app is deployed into by default. */
export const REMOTE_DIR_NAME = 'mastra-app';
/** Default port the Mastra server listens on. */
export const DEFAULT_PORT = 4111;
/** Launch script written into the remote dir. Re-running it restarts the server (e.g. after a wake). */
export const SERVER_SCRIPT = '.mastra-server.sh';
/** Pidfile written by the launch script. */
export const SERVER_PIDFILE = '.mastra-server.pid';
/** Server log file inside the remote dir. */
export const SERVER_LOGFILE = '.mastra-server.log';
/** Marker recording the package.json hash of the last completed dependency install. */
export const INSTALL_MARKER = '.mastra-install-hash';

/** getInfo may be sync or async, and may throw — normalize to `undefined` on failure. */
export async function getInfoSafe(sandbox: WorkspaceSandbox): Promise<SandboxInfo | undefined> {
  try {
    return await sandbox.getInfo?.();
  } catch {
    return undefined;
  }
}

/**
 * Resolve the directory the app is (or will be) deployed into. Defaults to
 * `$HOME/mastra-app` resolved inside the sandbox — home directories persist
 * across snapshot stop/resume on providers that support it, unlike `/tmp`.
 * The sandbox must be running.
 */
export async function resolveRemoteDir(sandbox: WorkspaceSandbox, remoteDir?: string): Promise<string> {
  if (remoteDir) return remoteDir;
  const result = await runInSandbox(sandbox, `printf %s "\${HOME:-$(pwd)}"`, { allowFailure: true });
  const base = result.stdout.trim();
  if (!base) {
    throw new Error('Could not resolve the sandbox home directory. Pass `remoteDir` explicitly.');
  }
  return `${base}/${REMOTE_DIR_NAME}`;
}

/** Single-quote a value for POSIX shells. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Run a shell script string inside the sandbox and throw on failure. */
export async function runInSandbox(
  sandbox: WorkspaceSandbox,
  script: string,
  opts?: {
    allowFailure?: boolean;
    timeout?: number;
    /** Safe description used in error messages instead of the script itself. */
    label?: string;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!sandbox.executeCommand) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" does not support executeCommand, which is required for sandbox deploys.`,
    );
  }
  // Run via `sh -c` (argv style): providers pass `command` straight to their
  // exec API as an executable, so a raw script string with spaces would fail.
  const result = await sandbox.executeCommand(
    'sh',
    ['-c', script],
    opts?.timeout ? { timeout: opts.timeout } : undefined,
  );
  if (!result.success && !opts?.allowFailure) {
    // Never echo the full script back: it can contain secrets (env values)
    // or entire base64 upload chunks. Use the label or a bounded excerpt.
    const what = opts?.label ?? truncate(script, 120);
    throw new Error(
      `Command failed inside sandbox (exit ${result.exitCode}): ${what}\n${truncate(result.stderr || result.stdout, 4_000)}`,
    );
  }
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… (truncated)` : value;
}

/**
 * Kill the previously launched server (if any) using its pidfile, waiting for
 * the process to exit (bounded, then SIGKILL) so the replacement never races
 * the old server for the port. Safe when nothing is running.
 */
export async function killPreviousServer(sandbox: WorkspaceSandbox, remoteDir: string): Promise<void> {
  const pidfile = shellQuote(`${remoteDir}/${SERVER_PIDFILE}`);
  const script = [
    `if [ -f ${pidfile} ]; then`,
    `  pid="$(cat ${pidfile})"`,
    `  kill "$pid" 2>/dev/null || true`,
    // Wait up to ~5s for the old server to release the port, then force-kill.
    `  i=0`,
    `  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i + 1)); done`,
    `  kill -9 "$pid" 2>/dev/null || true`,
    `  rm -f ${pidfile}`,
    `fi`,
  ].join('\n');
  await runInSandbox(sandbox, script, { allowFailure: true, timeout: 15_000 });
}

/**
 * Launch (or relaunch) the server by running the recorded launch script,
 * detached via nohup. Deliberately NOT `processes.spawn()`: provider process
 * handles follow the command's log stream, which would keep the calling
 * process's event loop alive for as long as the server runs. The server's
 * lifecycle is managed through its pidfile instead.
 */
export async function launchServer(sandbox: WorkspaceSandbox, remoteDir: string): Promise<void> {
  const script = `${remoteDir}/${SERVER_SCRIPT}`;
  await runInSandbox(sandbox, `nohup sh ${shellQuote(script)} >/dev/null 2>&1 & echo launched`);
}

/** Tail the server log from inside the sandbox. */
export async function tailServerLog(sandbox: WorkspaceSandbox, remoteDir: string, lines = 50): Promise<string> {
  const logfile = `${remoteDir}/${SERVER_LOGFILE}`;
  const result = await runInSandbox(
    sandbox,
    `tail -n ${Math.floor(lines)} ${shellQuote(logfile)} 2>/dev/null || true`,
    {
      allowFailure: true,
    },
  );
  return result.stdout;
}

/**
 * Poll `${url}${path}` until the server responds. Any HTTP status below 500
 * counts as "the server is up" — gateway errors (502/503) mean nothing is
 * listening on the port, and 410 is what some providers (e.g. Vercel) return
 * from their edge when the sandbox itself is stopped.
 */
export async function waitForHealthy(
  url: string,
  opts: { path?: string; timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const path = opts.path ?? '/api';
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(new URL(path, url), { signal: AbortSignal.timeout(intervalMs * 5) });
      // A provider-edge error header means the response came from the sandbox
      // infrastructure (stopped/unreachable VM), not from the Mastra server.
      const providerError = res.status === 410 || res.headers.has('x-vercel-error');
      if (res.status < 500 && !providerError) {
        return true;
      }
    } catch {
      // Not reachable yet.
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}
