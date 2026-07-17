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

/** Options for deploying a non-HTTP worker or trusted custom command. */
export interface DeployWorkerToSandboxOptions {
  /** The workspace sandbox to deploy into. Only `executeCommand` is required. */
  sandbox: WorkspaceSandbox;
  /** Local directory containing the prebuilt worker artifact. */
  dir: string;
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
  /** Persistent directory inside the sandbox. */
  remoteDir?: string;
  /** Trusted dependency installation command. Defaults to `npm install --omit=dev`. */
  installCommand?: string;
  /** Dependency installation timeout in milliseconds. */
  installTimeoutMs?: number;
  /** Time allowed for launch to report a running or exited process. Defaults to 10000. */
  startupTimeoutMs?: number;
  /** Optional maximum worker execution time before graceful and then forced termination. */
  executionTimeoutMs?: number;
  /** Grace period before forced termination. Defaults to 5000. */
  terminationGraceMs?: number;
}

export type SandboxWorkerStatus =
  | { state: 'running' }
  | { state: 'exited'; exitCode: number }
  | { state: 'cancelled' }
  | { state: 'unknown' };

/** A deployed non-HTTP worker. */
export interface SandboxWorkerDeployment {
  sandboxId: string;
  expiresAt?: Date;
  status(): Promise<SandboxWorkerStatus>;
  logs(lines?: number): Promise<string>;
  cancel(): Promise<void>;
  /** Snapshot-stop the sandbox. The worker can be relaunched after the sandbox wakes. */
  stop(): Promise<void>;
  destroy(): Promise<void>;
  /** Relaunch the recorded command unless it is already running. */
  relaunch(): Promise<void>;
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
