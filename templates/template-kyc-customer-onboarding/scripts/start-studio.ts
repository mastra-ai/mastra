import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const cliEntry = fileURLToPath(import.meta.resolve('mastra'));
const studioPort = process.env.STUDIO_PORT ?? argument('--port') ?? '4111';
const studioDataRoot = process.env.STUDIO_DATA_ROOT ?? argument('--data-root');
const primaryDataRoot = resolve(process.env.DEMO_DATA_ROOT ?? './data');
const studioDataPath = studioDataRoot === undefined ? undefined : resolve(studioDataRoot);
const studioAnalyticsPath =
  process.env.STUDIO_ANALYTICS_PATH ??
  (studioDataPath === undefined
    ? undefined
    : resolve(
        studioDataPath === primaryDataRoot ? resolve(studioDataPath, 'studio') : studioDataPath,
        'analytics.duckdb',
      ));
const studioStorageEnvironment =
  studioDataPath === undefined || studioAnalyticsPath === undefined
    ? {}
    : {
        DEMO_DATA_ROOT: studioDataPath,
        LIBSQL_DOMAIN_URL: `file:${resolve(studioDataPath, 'kyc.db')}`,
        LIBSQL_MASTRA_URL: `file:${resolve(studioDataPath, 'mastra.db')}`,
        DUCKDB_URL: studioAnalyticsPath,
        DOCUMENT_STORAGE_PATH: resolve(studioDataPath, 'documents'),
      };
const telemetryDisabledEnvironment = {
  ...process.env,
  ...studioStorageEnvironment,
  MASTRA_TELEMETRY_DISABLED: '1',
  PORT: studioPort,
};

const child = spawn(process.execPath, [cliEntry, 'dev'], {
  cwd: process.cwd(),
  env: telemetryDisabledEnvironment,
  stdio: 'inherit',
});

type ManagedChild = Readonly<{
  child: ChildProcess;
  rootPid: number | undefined;
  processIds: Set<number>;
}>;

const managedChild: ManagedChild = {
  child,
  rootPid: child.pid,
  processIds: new Set(child.pid === undefined ? [] : [child.pid]),
};
let shuttingDown = false;
let forceShutdownTimer: NodeJS.Timeout | undefined;
let shutdownCheckTimer: NodeJS.Timeout | undefined;

const discoverProcessIds = (rootPid: number): ReadonlySet<number> => {
  const processIds = new Set<number>([rootPid]);
  try {
    const processRows = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' });
    const childrenByParent = new Map<number, number[]>();
    for (const row of processRows.split('\n')) {
      const [pidValue, parentPidValue] = row.trim().split(/\s+/u);
      const pid = Number(pidValue);
      const parentPid = Number(parentPidValue);
      if (![pid, parentPid].every(Number.isInteger)) continue;
      const children = childrenByParent.get(parentPid) ?? [];
      children.push(pid);
      childrenByParent.set(parentPid, children);
    }

    const pending = [rootPid];
    const visited = new Set<number>();
    while (pending.length > 0) {
      const parentPid = pending.pop();
      if (parentPid === undefined || visited.has(parentPid)) continue;
      visited.add(parentPid);
      for (const processId of childrenByParent.get(parentPid) ?? []) {
        processIds.add(processId);
        pending.push(processId);
      }
    }
  } catch {
    // The root process is still available when descendant discovery is unavailable.
  }
  return processIds;
};

const refreshProcessIds = (): void => {
  if (process.platform === 'win32' || managedChild.rootPid === undefined) return;
  for (const processId of discoverProcessIds(managedChild.rootPid)) {
    managedChild.processIds.add(processId);
  }
};

const terminate = (signal: NodeJS.Signals): void => {
  const { rootPid } = managedChild;
  if (rootPid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(rootPid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])], {
        stdio: 'ignore',
      });
    } else {
      refreshProcessIds();
      for (const processId of [...managedChild.processIds].reverse()) {
        try {
          process.kill(processId, signal);
        } catch {
          // This process has already stopped.
        }
      }
    }
  } catch {
    // The Studio process tree may have exited between signal attempts.
  }
};

const isRunning = (): boolean => {
  const { rootPid } = managedChild;
  if (rootPid === undefined) return false;
  if (process.platform === 'win32') {
    return child.exitCode === null && child.signalCode === null;
  }
  refreshProcessIds();
  for (const processId of managedChild.processIds) {
    try {
      process.kill(processId, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return true;
    }
  }
  return false;
};

const stopShutdownTimers = (): void => {
  if (forceShutdownTimer !== undefined) clearTimeout(forceShutdownTimer);
  if (shutdownCheckTimer !== undefined) clearInterval(shutdownCheckTimer);
  forceShutdownTimer = undefined;
  shutdownCheckTimer = undefined;
};

const shutdown = (signal: NodeJS.Signals, exitCode: number): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  terminate(signal);
  forceShutdownTimer = setTimeout(() => {
    terminate('SIGKILL');
    if (shutdownCheckTimer !== undefined) clearInterval(shutdownCheckTimer);
    shutdownCheckTimer = undefined;
  }, 5_000);
  shutdownCheckTimer = setInterval(() => {
    if (isRunning()) return;
    stopShutdownTimers();
  }, 50);
  shutdownCheckTimer.unref();
};

process.once('SIGINT', () => shutdown('SIGINT', 130));
process.once('SIGTERM', () => shutdown('SIGTERM', 143));
process.once('SIGHUP', () => shutdown('SIGHUP', 129));

child.once('error', error => {
  console.error('Unable to start the local Studio process.', error);
  shutdown('SIGTERM', 1);
});

child.once('exit', (code, signal) => {
  if (shuttingDown) return;
  shutdown(signal ?? 'SIGTERM', signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : (code ?? 1));
});
