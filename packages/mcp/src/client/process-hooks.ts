/**
 * Process-level teardown shared by every MCP client in the process.
 *
 * The signal listeners are installed only while at least one client holds a hook, and removed
 * again when the last one is released. That is what lets a host keep its own shutdown after it
 * disconnects every client: a signal that arrives afterwards reaches the host's handlers alone
 * (#29547).
 *
 * `exit-hook` could not do this. It installs its listeners once behind a module flag and never
 * removes them, so its callback set could be emptied while the listeners that end the process
 * stayed behind (#27478).
 */

/** A teardown that runs when the process is asked to end, bounded by `wait` milliseconds. */
interface ProcessHook {
  onExit: () => Promise<void>;
  wait: number;
}

type HookedSignal = 'SIGHUP' | 'SIGINT' | 'SIGTERM';

/** 128 + the signal's number, the convention shells and process supervisors read. */
const SIGNAL_EXIT_CODES: Record<HookedSignal, number> = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };

const hooks = new Set<ProcessHook>();
let listenersInstalled = false;
let exiting = false;

const signalListeners = Object.fromEntries(
  (Object.keys(SIGNAL_EXIT_CODES) as HookedSignal[]).map(signal => [
    signal,
    () => void runHooksAndExit(SIGNAL_EXIT_CODES[signal]),
  ]),
) as Record<HookedSignal, () => void>;

// An emptied event loop ends the process, so the hooks run then too.
const onBeforeExit = () => void runHooksAndExit();

// PM2 cluster mode asks workers to stop with an IPC message instead of a signal.
const onMessage = (message: unknown) => {
  if (message === 'shutdown') void runHooksAndExit();
};

function installListeners() {
  listenersInstalled = true;
  for (const [signal, listener] of Object.entries(signalListeners) as [HookedSignal, () => void][]) {
    process.on(signal, listener);
  }
  process.on('beforeExit', onBeforeExit);
  process.on('message', onMessage);
}

/**
 * Removes the process listeners. Each removal is attempted on its own: a host that refuses one
 * `process.off` call must not keep the listeners the other calls could still remove (#30820).
 *
 * A refusal is re-thrown for the caller to report, and the listeners stay marked as installed so
 * that a later release retries the removal instead of adding a second set of them.
 */
function removeListeners() {
  let failure: unknown;
  const attempt = (remove: () => void) => {
    try {
      remove();
    } catch (error) {
      failure ??= error;
    }
  };

  for (const [signal, listener] of Object.entries(signalListeners) as [HookedSignal, () => void][]) {
    attempt(() => process.off(signal, listener));
  }
  attempt(() => process.off('beforeExit', onBeforeExit));
  attempt(() => process.off('message', onMessage));

  if (failure) throw failure;
  listenersInstalled = false;
}

/**
 * Runs every hook, then ends the process. Only the first call runs hooks: a signal followed by the
 * event loop emptying, or a supervisor sending a second one, must not tear the same clients down
 * twice.
 */
async function runHooksAndExit(signalExitCode?: number) {
  if (exiting) return;
  exiting = true;

  const exitCode = signalExitCode ?? (Number(process.exitCode) || 0);
  const pending = [...hooks];
  // A hook that never settles must not keep the process alive past its own budget.
  const timer = setTimeout(
    () => process.exit(exitCode),
    Math.max(0, ...pending.map(hook => hook.wait)),
  );

  await Promise.allSettled(pending.map(hook => hook.onExit()));
  clearTimeout(timer);

  await flushStdio();
  process.exit(exitCode);
}

/**
 * Waits for stdout and stderr to drain, so lines a hook printed are not lost to the exit. Bounded,
 * because a stream nobody is reading from would otherwise block the exit forever.
 */
function flushStdio() {
  const flush = (stream: NodeJS.WriteStream) =>
    new Promise<void>(resolve => {
      if (!stream.writable) {
        resolve();
        return;
      }
      try {
        stream.write('', () => resolve());
      } catch {
        resolve();
      }
    });

  return Promise.race([
    Promise.all([flush(process.stdout), flush(process.stderr)]),
    new Promise<void>(resolve => setTimeout(resolve, 1000)),
  ]);
}

/**
 * Runs `onExit` when the process receives `SIGINT`, `SIGTERM` or `SIGHUP`, when its event loop
 * empties, or when a supervisor sends the PM2 `shutdown` message, and then ends the process
 * (`128 + the signal's number` for signals). The listeners exist only while at least one hook
 * does, so releasing the last hook leaves the host's own shutdown alone.
 *
 * @returns A function that releases the hook. Releasing it is what removes the listeners once no
 * other hook is left.
 */
export function addProcessHook(onExit: () => Promise<void>, { wait }: { wait: number }): () => void {
  const hook: ProcessHook = { onExit, wait };
  if (!listenersInstalled) installListeners();
  hooks.add(hook);

  return () => {
    if (!hooks.has(hook)) return;
    // The listeners go only when the last hook does, and only while the process is not already
    // exiting: a hook releasing itself mid-teardown must not hand a second signal to Node's
    // default handler before the other hooks have run. A refused removal throws before the hook is
    // dropped, so the hook stays tracked and a later release retries it (#30820).
    if (hooks.size === 1 && !exiting) removeListeners();
    hooks.delete(hook);
  };
}
