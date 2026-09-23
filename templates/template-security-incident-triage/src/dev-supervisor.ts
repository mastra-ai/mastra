import { createServer } from 'node:net';
import { spawn, type SpawnOptions } from 'node:child_process';
import { join } from 'node:path';

type DevelopmentChild = Readonly<{
  killed?: boolean;
  kill(signal?: NodeJS.Signals): boolean;
  on(event: 'error', listener: (error: Error) => void): DevelopmentChild;
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): DevelopmentChild;
}>;

type SpawnDevelopmentChild = (command: string, args: readonly string[], options: SpawnOptions) => DevelopmentChild;

type HealthFetch = (input: string, init: Readonly<{ signal: AbortSignal }>) => Promise<Readonly<{ ok: boolean }>>;

type SignalTarget = Pick<NodeJS.Process, 'once' | 'removeListener'>;

export type DevelopmentSupervisor = Readonly<{
  stop(signal?: NodeJS.Signals): void;
}>;

export type DevelopmentSupervisorOptions = Readonly<{
  root?: string;
  environment?: NodeJS.ProcessEnv;
  healthTimeoutMs?: number;
  healthRetryMs?: number;
  spawnChild?: SpawnDevelopmentChild;
  fetchHealth?: HealthFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  reportError?: (message: string) => void;
  /** Installs SIGINT/SIGTERM ownership before the Hono child is spawned. */
  installSignalHandlers?: boolean;
  /** Test seam for process signal ownership; production defaults to process. */
  signalTarget?: SignalTarget;
}>;

const defaultSleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const defaultHealthFetch: HealthFetch = (input, init) => fetch(input, init);

/** Wait for the Hono-owned health endpoint without ever starting Studio early. */
export async function waitForDevelopmentHealth(
  url: string,
  options: Readonly<{
    timeoutMs: number;
    retryMs: number;
    fetchHealth?: HealthFetch;
    sleep?: (milliseconds: number) => Promise<void>;
    signal?: AbortSignal;
  }>,
): Promise<void> {
  const deadline = Date.now() + options.timeoutMs;
  const fetchHealth = options.fetchHealth ?? defaultHealthFetch;
  const sleep = options.sleep ?? defaultSleep;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error('Development startup aborted');
    const controller = new AbortController();
    const abortForShutdown = () => controller.abort();
    options.signal?.addEventListener('abort', abortForShutdown, { once: true });
    const abortTimer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
    try {
      if ((await fetchHealth(url, { signal: controller.signal })).ok) return;
    } catch {
      // Startup can legitimately race the first health request; the bounded
      // loop is the only retry policy and never starts Studio on failure.
    } finally {
      clearTimeout(abortTimer);
      options.signal?.removeEventListener('abort', abortForShutdown);
    }
    if (Date.now() >= deadline) break;
    await sleep(Math.min(options.retryMs, deadline - Date.now()));
  }

  throw new Error(`Hono health check timed out: ${url}`);
}

/**
 * Own both local development children. Hono is initialized first so the two
 * processes cannot concurrently create the shared LibSQL schema. Studio gets
 * the same storage URL and an empty inherited PORT: Mastra treats it as owned
 * by the launcher, then selects its documented 4111+ development port instead
 * of reloading Hono's PORT from .env.
 */
export async function startDevelopment(options: DevelopmentSupervisorOptions = {}): Promise<DevelopmentSupervisor> {
  const root = options.root ?? process.cwd();
  const environment = options.environment ?? process.env;
  const port = Number.parseInt(environment.PORT ?? '3000', 10);
  const honoPort = Number.isSafeInteger(port) && port > 0 ? port : 3000;
  const spawnChild = options.spawnChild ?? spawn;
  const reportError = options.reportError ?? console.error;
  const mastraExecutable = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'mastra.cmd' : 'mastra');
  const children: DevelopmentChild[] = [];
  const startupAbort = new AbortController();
  let state: 'starting' | 'running' | 'stopping' | 'failed' = 'starting';
  let failure: Error | undefined;
  const signalTarget = options.signalTarget ?? process;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  const terminateChildren = (signal: NodeJS.Signals) => {
    for (const child of children) {
      if (!child.killed) child.kill(signal);
    }
  };

  const removeSignalHandlers = () => {
    for (const [signal, handler] of signalHandlers) {
      signalTarget.removeListener(signal, handler);
    }
    signalHandlers.clear();
  };

  const stop = (signal: NodeJS.Signals = 'SIGTERM') => {
    if (state === 'stopping' || state === 'failed') return;
    state = 'stopping';
    startupAbort.abort();
    removeSignalHandlers();
    terminateChildren(signal);
  };

  const fail = (message: string) => {
    if (state === 'stopping' || state === 'failed') return;
    failure = new Error(message);
    state = 'failed';
    process.exitCode = 1;
    startupAbort.abort();
    removeSignalHandlers();
    reportError(message);
    terminateChildren('SIGTERM');
  };

  if (options.installSignalHandlers) {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => stop(signal);
      signalHandlers.set(signal, handler);
      signalTarget.once(signal, handler);
    }
  }

  const observe = (child: DevelopmentChild, name: string) => {
    child.on('error', error => {
      fail(`${name} failed: ${error.message}`);
    });
    child.on('exit', (code, signal) => {
      fail(`${name} exited before shutdown (code=${code}, signal=${signal})`);
    });
  };

  const server = spawnChild(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'src/start.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: environment,
  });
  children.push(server);
  observe(server, 'Hono server');

  try {
    await waitForDevelopmentHealth(`http://127.0.0.1:${honoPort}/health`, {
      // A fresh checkout may need to download and index the embedding model
      // before the server exposes health. Subsequent starts use the cache and
      // the active-generation check, so they remain fast.
      timeoutMs: options.healthTimeoutMs ?? 60_000,
      retryMs: options.healthRetryMs ?? 100,
      fetchHealth: options.fetchHealth,
      sleep: options.sleep,
      signal: startupAbort.signal,
    });
  } catch (error) {
    if (failure) throw failure;
    if (startupAbort.signal.aborted) return Object.freeze({ stop });
    stop();
    throw error;
  }

  if (failure) throw failure;
  if (startupAbort.signal.aborted) return Object.freeze({ stop });

  const studioEnvironment = { ...environment };
  studioEnvironment.PORT = '';
  const studio = spawnChild(mastraExecutable, ['dev'], {
    cwd: root,
    stdio: 'inherit',
    env: studioEnvironment,
  });
  children.push(studio);
  observe(studio, 'Mastra Studio');
  state = 'running';

  return Object.freeze({ stop });
}

/** Detect an existing server before its health endpoint can satisfy our startup probe. */
export async function assertDevelopmentPortAvailable(port: number): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', () =>
      reject(new Error(`Development port ${port} is unavailable. Stop its server or set PORT to a free port.`)),
    );
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () =>
      probe.close(error => (error ? reject(error) : resolve())),
    );
  });
}
