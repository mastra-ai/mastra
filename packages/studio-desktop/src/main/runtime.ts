import type { ChildProcess, SpawnOptionsWithoutStdio } from 'node:child_process';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DesktopSettings, RuntimeStatus } from '../shared/types';
import { LOCALHOST } from './defaults';
import type { LogBuffer } from './log-buffer';

export type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => Pick<ChildProcess, 'pid' | 'kill' | 'on' | 'stdout' | 'stderr'>;

interface ManagedRuntimeOptions {
  outputDir: string;
  userDataPath: string;
  logs: LogBuffer;
  spawnFn?: SpawnFn;
  nodePath?: string;
}

export class ManagedMastraRuntime {
  readonly #outputDir: string;
  readonly #userDataPath: string;
  readonly #logs: LogBuffer;
  readonly #spawnFn: SpawnFn;
  readonly #nodePath: string;
  #child?: Pick<ChildProcess, 'pid' | 'kill' | 'on' | 'stdout' | 'stderr'>;
  #status: RuntimeStatus = { state: 'idle' };

  constructor(options: ManagedRuntimeOptions) {
    this.#outputDir = options.outputDir;
    this.#userDataPath = options.userDataPath;
    this.#logs = options.logs;
    this.#spawnFn = options.spawnFn ?? spawn;
    this.#nodePath = options.nodePath ?? process.execPath;
  }

  get status(): RuntimeStatus {
    return { ...this.#status };
  }

  async start(settings: DesktopSettings, port: number): Promise<RuntimeStatus> {
    if (this.#child) {
      return this.status;
    }

    const entryFile = join(this.#outputDir, 'index.mjs');
    if (!existsSync(entryFile)) {
      this.#status = {
        state: 'error',
        error: `Mastra starter runtime was not built at ${entryFile}`,
      };
      this.#logs.add(this.#status.error);
      return this.status;
    }

    this.#status = {
      state: 'starting',
      port,
      url: `http://${LOCALHOST}:${port}`,
    };

    const child = this.#spawnFn(this.#nodePath, ['index.mjs'], {
      cwd: this.#outputDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...settings.environmentVariables,
        ELECTRON_RUN_AS_NODE: '1',
        MASTRA_DEV: 'true',
        MASTRA_DISABLE_GATEWAY_REGISTRY_SYNC: 'true',
        NODE_ENV: 'production',
        HOST: LOCALHOST,
        PORT: String(port),
        MASTRA_TELEMETRY_DISABLED: 'true',
        MASTRA_PROJECT_ROOT: this.#userDataPath,
        MASTRA_DESKTOP_DB_URL: `file:${join(this.#userDataPath, 'mastra-desktop.db')}`,
        MASTRA_DESKTOP_STORAGE_DIR: join(this.#userDataPath, 'storage'),
        MASTRA_DESKTOP_MODEL_URL: settings.modelUrl,
        MASTRA_DESKTOP_MODEL_ID: settings.modelId,
        MASTRA_DESKTOP_MODEL_API_KEY: settings.modelApiKey,
      },
    });

    this.#child = child;
    this.#status = {
      state: 'running',
      pid: child.pid,
      port,
      url: `http://${LOCALHOST}:${port}`,
    };

    child.stdout?.on('data', data => this.#logs.add(String(data)));
    child.stderr?.on('data', data => this.#logs.add(String(data)));
    child.on('error', error => {
      this.#logs.add(`Mastra runtime failed: ${error.message}`);
      this.#status = {
        ...this.#status,
        state: 'error',
        error: error.message,
      };
      this.#child = undefined;
    });
    child.on('exit', code => {
      this.#logs.add(`Mastra runtime exited with code ${code ?? 'unknown'}`);
      this.#status = {
        ...this.#status,
        state: code === 0 ? 'stopped' : 'error',
        error: code === 0 ? undefined : `Mastra runtime exited with code ${code ?? 'unknown'}`,
      };
      this.#child = undefined;
    });

    return this.status;
  }

  async stop() {
    if (!this.#child) {
      this.#status = { state: 'stopped' };
      return this.status;
    }

    const child = this.#child;
    await new Promise<void>(resolve => {
      const finish = () => resolve();
      child.on('exit', finish);
      child.kill('SIGTERM');
      setTimeout(() => resolve(), 1500).unref();
    });

    if (this.#child === child) {
      this.#child = undefined;
    }
    this.#status = { state: 'stopped' };
    return this.status;
  }

  async restart(settings: DesktopSettings, port: number) {
    await this.stop();
    return this.start(settings, port);
  }
}
