/**
 * Fake in-memory WorkspaceSandbox for engine/client unit tests. Implements
 * only the core contract the deploy engine relies on — proving the engine is
 * provider-agnostic.
 */
import type {
  CommandResult,
  ExecuteCommandOptions,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
  SandboxNetworking,
  SandboxProcessManager,
  WorkspaceSandbox,
} from '@mastra/core/workspace';

export interface FakeSandboxOptions {
  /** Public URL returned for any port. Defaults to https://fake-sandbox.example. */
  url?: string | null;
  /** Enable the writeFiles fast path. Defaults to true. */
  withWriteFiles?: boolean;
  /** Enable the networking capability. Defaults to true. */
  withNetworking?: boolean;
  /** Content returned when a command `cat`s the install marker. */
  installMarker?: string;
  /** Content returned when a command tails a deployment log. */
  serverLog?: string;
  /** Status returned when worker lifecycle state is queried. Defaults to running. */
  workerStatus?: 'running' | 'cancelled' | `exited ${number}` | 'unknown';
  /** Provide info returned from getInfo(). */
  info?: Partial<SandboxInfo>;
}

export class FakeSandbox implements WorkspaceSandbox {
  readonly id = 'fake-sandbox-1';
  readonly name = 'FakeSandbox';
  readonly provider = 'fake';
  status: ProviderStatus = 'running';

  started = 0;
  stopped = 0;
  destroyed = 0;
  /** Every shell script passed to executeCommand, in order. */
  commands: string[] = [];
  /** Every writeFiles() call. */
  writtenFiles: SandboxFileInput[][] = [];
  /** Every processes.spawn() command. */
  spawned: string[] = [];

  readonly networking?: SandboxNetworking;
  writeFiles?: (files: SandboxFileInput[]) => Promise<void>;
  // Minimal spawn-only process manager — the engine only calls spawn().
  readonly processes?: SandboxProcessManager;

  private readonly opts: FakeSandboxOptions;

  constructor(opts: FakeSandboxOptions = {}) {
    this.opts = opts;

    if (opts.withNetworking !== false) {
      this.networking = {
        getPortUrl: async () => (opts.url === undefined ? 'https://fake-sandbox.example' : opts.url),
      };
    }
    if (opts.withWriteFiles !== false) {
      this.writeFiles = async files => {
        this.writtenFiles.push(files);
      };
    }
    this.processes = {
      spawn: async (command: string) => {
        this.spawned.push(command);
        return { pid: `pid-${this.spawned.length}` };
      },
    } as unknown as SandboxProcessManager;
  }

  async start(): Promise<void> {
    this.started++;
  }
  async stop(): Promise<void> {
    this.stopped++;
  }
  async destroy(): Promise<void> {
    this.destroyed++;
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: 'fake-info-id',
      name: 'fake',
      provider: this.provider,
      status: 'running',
      createdAt: new Date('2026-01-01'),
      ...this.opts.info,
    };
  }

  async executeCommand(command: string, args?: string[], _options?: ExecuteCommandOptions): Promise<CommandResult> {
    // The engine runs shell scripts argv-style as `sh -c <script>` (real
    // providers pass `command` straight to their exec API as an executable).
    // Record the script itself so tests can assert on its contents.
    const script = command === 'sh' && args?.[0] === '-c' && args[1] ? args[1] : command;
    this.commands.push(script);

    let stdout = '';
    if (script.includes('.mastra-install-hash') && script.startsWith('cat')) {
      stdout = this.opts.installMarker ?? '';
    } else if (script.startsWith('tail')) {
      stdout = this.opts.serverLog ?? '';
    } else if (script.includes('kill -0') && script.includes('.mastra-worker.status')) {
      stdout = this.opts.workerStatus ?? 'running';
    } else if (script.includes('$HOME') || script.includes('${HOME')) {
      stdout = '/home/fake';
    }

    return {
      success: true,
      exitCode: 0,
      stdout,
      stderr: '',
      executionTimeMs: 1,
    };
  }
}

/** Create a minimal prebuilt Mastra output dir (index.mjs + package.json) for tests. */
export async function makeBuildDir(base: string): Promise<string> {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(base, 'mastra-build-'));
  await writeFile(join(dir, 'index.mjs'), `console.log('server');`);
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'fake-app', dependencies: {} }));
  return dir;
}
