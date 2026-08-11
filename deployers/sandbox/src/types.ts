import type { WorkspaceSandbox } from '@mastra/core/workspace';

/** Minimal logger contract used by the engine (compatible with IMastraLogger). */
export interface SandboxDeployLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

/** Tier 3 stable-alias configuration: keep a Vercel Edge Config item pointed at the current sandbox URL. */
export interface SandboxAliasOptions {
  /** Edge Config ID (e.g. `ecfg_...`) */
  edgeConfigId: string;
  /** Item key to upsert with the sandbox URL */
  key: string;
  /** Vercel API token with Edge Config write access. */
  token: string;
  /** Vercel team ID (optional). */
  teamId?: string;
}

export interface SandboxDeployerOptions {
  /** The workspace sandbox to deploy into. Must support `executeCommand` and `networking`. */
  sandbox: WorkspaceSandbox;
  /** Port the Mastra server listens on inside the sandbox. Defaults to 4111. */
  port?: number;
  /** Extra environment variables for the server (merged over `.env` files). */
  env?: Record<string, string>;
  /** Bundle and serve Mastra Studio alongside the API. Defaults to true. */
  studio?: boolean;
  /** Optional Tier 3 stable alias (Vercel Edge Config). */
  alias?: SandboxAliasOptions;
  /** Directory inside the sandbox to deploy into. Defaults to `$HOME/mastra-app` (persists across snapshot stop/resume, unlike `/tmp`). */
  remoteDir?: string;
  /** Max time to wait for the server health check, in ms. Defaults to 60000. */
  healthCheckTimeoutMs?: number;
}

/** Options for the one-shot programmatic deploy (no bundler — takes a prebuilt output dir). */
export interface DeployToSandboxOptions {
  /** The workspace sandbox to deploy into. Must support `executeCommand` and `networking`. */
  sandbox: WorkspaceSandbox;
  /** Local directory containing the built Mastra server (`index.mjs` + `package.json`). */
  dir: string;
  /** Port the Mastra server listens on inside the sandbox. Defaults to 4111. */
  port?: number;
  /** Environment variables injected into the server process. */
  env?: Record<string, string>;
  /** Serve the Studio assets uploaded with the build (sets `MASTRA_STUDIO_PATH`). Defaults to false. */
  studio?: boolean;
  /** Directory inside the sandbox to deploy into. Defaults to `$HOME/mastra-app` (persists across snapshot stop/resume, unlike `/tmp`). */
  remoteDir?: string;
  /** Path polled for health. Defaults to `/api`. */
  healthCheckPath?: string;
  /** Max time to wait for the server health check, in ms. Defaults to 60000. */
  healthCheckTimeoutMs?: number;
  /** Poll interval for the health check, in ms. Defaults to 1000. */
  healthCheckIntervalMs?: number;
  /**
   * Install command run inside the sandbox. Defaults to `npm install --omit=dev`.
   *
   * Executed verbatim as a shell command (so flags, `&&`, env prefixes, etc.
   * work). Only ever pass trusted, developer-authored values — never derive
   * this from user input.
   */
  installCommand?: string;
  logger?: SandboxDeployLogger;
}

/** Input staged before a non-HTTP process starts. */
export type SandboxWorkerInput =
  | { type: 'stdin'; data: string | Uint8Array }
  | { type: 'file'; path: string; data: string | Uint8Array };

export interface SandboxWorkerResourceLimits {
  /** Maximum CPU time in seconds. */
  cpuTimeSeconds?: number;
  /** Maximum virtual address space in bytes. Enforced in 1 KiB units, rounded down. */
  addressSpaceBytes?: number;
  /** Maximum file size in bytes. Enforced in 512-byte units, rounded down. */
  fileSizeBytes?: number;
  /** Maximum number of open file descriptors. */
  openFiles?: number;
}

export type SandboxWorkerResourceLimitCapability =
  | 'sandbox_command'
  | 'linux_proc'
  | 'process_groups'
  | 'cpu_time'
  | 'address_space'
  | 'file_size'
  | 'open_files'
  | 'cpu_signal'
  | 'file_size_signal';

/** Error thrown before deployment when requested resource limits cannot be enforced. */
export class SandboxWorkerCapabilityError extends Error {
  readonly code = 'SANDBOX_WORKER_CAPABILITY_UNAVAILABLE';

  constructor(
    readonly capability: SandboxWorkerResourceLimitCapability,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? `Worker resource-limit capability "${capability}" is unavailable.`, options);
    this.name = 'SandboxWorkerCapabilityError';
  }
}

/** Options for deploying a non-HTTP worker or trusted custom command. */
export interface DeployWorkerToSandboxOptions {
  /** The workspace sandbox to deploy into. Only `executeCommand` is required. */
  sandbox: WorkspaceSandbox;
  /** Local directory containing the prebuilt worker artifact. */
  dir: string;
  /** Caller-owned execution identity used to namespace all runtime state. */
  executionId: string;
  /** Process lifecycle. Workers are expected to stay running; jobs may complete. Defaults to `worker`. */
  mode?: 'worker' | 'job';
  /** Trusted executable or executable path to launch (not a shell expression). */
  command: string;
  /** Trusted arguments passed to the executable. */
  args?: string[];
  /** Working directory relative to `remoteDir`. Defaults to the artifact root. */
  workingDirectory?: string;
  /** Environment variables injected before worker initialization. */
  env?: Record<string, string>;
  /** Bounded stdin or an artifact-relative file staged before launch. */
  input?: SandboxWorkerInput;
  /** Maximum accepted input size. Defaults to 16 MiB. */
  inputLimitBytes?: number;
  /** Persistent directory inside the sandbox. */
  remoteDir?: string;
  /** Trusted dependency installation command. Defaults to `npm install --omit=dev`. */
  installCommand?: string;
  /** Dependency installation timeout in milliseconds. */
  installTimeoutMs?: number;
  /** Time allowed for launch to report a running or terminal process. Defaults to 10000. */
  startupTimeoutMs?: number;
  /** Optional maximum process execution time before graceful and then forced termination. */
  executionTimeoutMs?: number;
  /** Hard limits applied only to the workload immediately before execution. */
  resourceLimits?: SandboxWorkerResourceLimits;
  /** Grace period before forced termination. Defaults to 5000. */
  terminationGraceMs?: number;
}

export type SandboxWorkerStatus =
  | { state: 'starting'; executionId: string }
  | { state: 'running'; executionId: string }
  | { state: 'exited'; executionId: string; exitCode: number; signal?: string }
  | {
      state: 'resource_exhausted';
      executionId: string;
      resource: 'cpu' | 'file_size';
      limit: number;
      signal: 'SIGXCPU' | 'SIGXFSZ';
    }
  | { state: 'cancelled'; executionId: string; signal?: string }
  | { state: 'timed_out'; executionId: string; phase: 'startup' | 'execution' }
  | { state: 'failed'; executionId: string; phase: 'upload' | 'install' | 'launch'; message: string }
  | { state: 'provider_unavailable'; executionId: string; providerState?: string; message?: string }
  | { state: 'unknown'; executionId: string };

export interface SandboxWorkerOutput {
  stream: 'stdout' | 'stderr';
  /** Raw bytes from the requested offset. */
  data: Uint8Array;
  offset: number;
  nextOffset: number;
  totalBytes: number;
  eof: boolean;
  truncated: boolean;
  interrupted: boolean;
}

export type SandboxDestroyResult =
  | { state: 'destroyed'; attempts: number }
  | { state: 'unsupported'; attempts: 0 }
  | { state: 'exhausted'; attempts: number; error: unknown };

/** A deployed non-HTTP process execution. */
export interface SandboxWorkerDeployment {
  sandboxId: string;
  executionId: string;
  expiresAt?: Date;
  /** Inspect without waking by default. Pass wake=true only when provider restoration is intentional. */
  status(options?: { wake?: boolean }): Promise<SandboxWorkerStatus>;
  readOutput(
    stream: 'stdout' | 'stderr',
    options?: { offset?: number; maxBytes?: number },
  ): Promise<SandboxWorkerOutput>;
  cancel(): Promise<SandboxWorkerStatus>;
  /** Snapshot-stop the sandbox. Process preservation is provider-specific and is never assumed. */
  stop(): Promise<void>;
  destroy(options?: { attempts?: number; delayMs?: number }): Promise<SandboxDestroyResult>;
  /** Launch the same recorded command under a new caller-provided execution identity. */
  relaunch(options: { executionId: string; input?: SandboxWorkerInput }): Promise<SandboxWorkerDeployment>;
}

/** A live sandbox deployment. */
export interface SandboxDeployment {
  /** Public URL of the Mastra server. */
  url: string;
  /** Provider sandbox ID (when available). */
  sandboxId: string;
  /** When the sandbox will auto-shutdown (when known). */
  expiresAt?: Date;
  /** Snapshot-stop the sandbox (resumable by provider identity, e.g. name). */
  stop(): Promise<void>;
  /** Tear the sandbox down. */
  destroy(): Promise<void>;
  /** Tail the server log from inside the sandbox. */
  logs(lines?: number): Promise<string>;
}

/** Contents of `sandbox-deployment.json` written next to the build output. */
export interface SandboxDeploymentManifest {
  provider: string;
  sandboxId: string;
  url: string;
  port: number;
  deployedAt: string;
  expiresAt?: string;
}
