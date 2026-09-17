import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

type Service = Readonly<{
  name: string;
  script: string;
  host: string;
  port: number;
  url: string;
  environment?: NodeJS.ProcessEnv;
}>;

type ManagedChild = Readonly<{
  child: ChildProcess;
  rootPid: number | undefined;
  processIds: Set<number>;
}>;

const repositoryRoot = resolve(import.meta.dirname, '..');

const parsePort = (name: string, fallback: number): number => {
  const value = process.env[name];
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
};

const host = process.env.HOST ?? '127.0.0.1';
const apiPort = parsePort('PORT', 4111);
const studioPort = parsePort('STUDIO_PORT', 4112);
const portalPort = parsePort('DEV_PORTAL_PORT', 5173);
const services: readonly Service[] = [
  {
    name: 'API',
    script: 'dev:api',
    host,
    port: apiPort,
    url: `http://127.0.0.1:${String(apiPort)}`,
    environment: { PORTAL_ORIGIN: `http://127.0.0.1:${String(portalPort)}` },
  },
  {
    name: 'Mastra Studio',
    script: 'dev:studio',
    host,
    port: studioPort,
    url: `http://127.0.0.1:${String(studioPort)}`,
    environment: {
      STUDIO_PORT: String(studioPort),
      STUDIO_DATA_ROOT: process.env.STUDIO_DATA_ROOT ?? './data/studio',
      PORTAL_ORIGIN: `http://127.0.0.1:${String(portalPort)}`,
    },
  },
  {
    name: 'Portal',
    script: 'dev:portal',
    host: '127.0.0.1',
    port: portalPort,
    url: `http://127.0.0.1:${String(portalPort)}`,
    environment: {
      DEV_PORTAL_PORT: String(portalPort),
      VITE_API_BASE_URL: `http://127.0.0.1:${String(apiPort)}`,
    },
  },
];

const duplicatePort = services.find(
  (service, index) => services.findIndex(candidate => candidate.port === service.port) !== index,
);
if (duplicatePort !== undefined) {
  throw new Error(`Development services cannot share port ${String(duplicatePort.port)}`);
}

const assertPortAvailable = async (service: Service): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', (error: NodeJS.ErrnoException) => {
      const reason =
        error.code === 'EADDRINUSE' ? 'is already in use' : `is unavailable (${error.code ?? 'unknown error'})`;
      reject(new Error(`${service.name} cannot start because ${service.host}:${String(service.port)} ${reason}`));
    });
    server.listen({ host: service.host, port: service.port, exclusive: true }, () => {
      server.close(error => {
        if (error === undefined) resolvePromise();
        else reject(error);
      });
    });
  });

await Promise.all(services.map(assertPortAvailable));

console.log('Starting the complete local review environment:');
for (const service of services) console.log(`- ${service.name}: ${service.url}`);

const npmEntry = process.env.npm_execpath;
const npmExecutable = npmEntry === undefined ? (process.platform === 'win32' ? 'npm.cmd' : 'npm') : process.execPath;
const children = new Map<string, ManagedChild>();
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

const refreshProcessIds = (managedChild: ManagedChild): void => {
  if (process.platform === 'win32' || managedChild.rootPid === undefined) return;
  for (const processId of discoverProcessIds(managedChild.rootPid)) {
    managedChild.processIds.add(processId);
  }
};

const terminate = (managedChild: ManagedChild, signal: NodeJS.Signals): void => {
  const { rootPid } = managedChild;
  if (rootPid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(rootPid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])], {
        stdio: 'ignore',
      });
    } else {
      refreshProcessIds(managedChild);
      for (const processId of [...managedChild.processIds].reverse()) {
        try {
          process.kill(processId, signal);
        } catch {
          // This process has already stopped.
        }
      }
    }
  } catch {
    // The process tree may have exited between signal attempts.
  }
};

const isRunning = (managedChild: ManagedChild): boolean => {
  const { child, rootPid } = managedChild;
  if (rootPid === undefined) return false;
  if (process.platform === 'win32') {
    return child.exitCode === null && child.signalCode === null;
  }
  refreshProcessIds(managedChild);
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

const scheduleForcedShutdown = (): void => {
  forceShutdownTimer = setTimeout(() => {
    for (const child of children.values()) terminate(child, 'SIGKILL');
    if (shutdownCheckTimer !== undefined) clearInterval(shutdownCheckTimer);
    shutdownCheckTimer = undefined;
  }, 5_000);
  shutdownCheckTimer = setInterval(() => {
    if ([...children.values()].some(isRunning)) return;
    stopShutdownTimers();
  }, 50);
  shutdownCheckTimer.unref();
};

const shutdown = (signal: NodeJS.Signals, exitCode: number): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of children.values()) terminate(child, signal);
  scheduleForcedShutdown();
};

process.once('SIGINT', () => shutdown('SIGINT', 130));
process.once('SIGTERM', () => shutdown('SIGTERM', 143));
process.once('SIGHUP', () => shutdown('SIGHUP', 129));

await new Promise<void>(resolvePromise => {
  let active = services.length;
  for (const service of services) {
    const child = spawn(npmExecutable, [...(npmEntry === undefined ? [] : [npmEntry]), 'run', service.script], {
      cwd: repositoryRoot,
      env: { ...process.env, ...service.environment },
      stdio: 'inherit',
    });
    children.set(service.name, {
      child,
      rootPid: child.pid,
      processIds: new Set(child.pid === undefined ? [] : [child.pid]),
    });
    child.once('error', error => {
      console.error(`${service.name} failed to start:`, error.message);
      shutdown('SIGTERM', 1);
    });
    child.once('exit', (code, signal) => {
      if (!shuttingDown) {
        console.error(`${service.name} stopped unexpectedly (${signal ?? String(code ?? 1)})`);
        shutdown('SIGTERM', code === null || code === 0 ? 1 : code);
      }
    });
    child.once('close', () => {
      active -= 1;
      if (active === 0) resolvePromise();
    });
  }
});
