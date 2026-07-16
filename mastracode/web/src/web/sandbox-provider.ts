/**
 * Sandbox provider seam for the web factory.
 *
 * `WebSandboxProvider` is the public, user-implementable interface behind
 * which sandbox providers plug into `MastraFactory` (the `sandbox` config
 * slot). Shipped implementations:
 *
 *  - `RailwaySandboxProvider` (`./sandbox-railway-provider.ts`) — isolated cloud VMs.
 *  - `LocalSandboxProvider` (`./sandbox-local-provider.ts`) — host-process checkouts
 *    for single-user local development.
 *
 * The github project machinery (`./github/sandbox.ts`) consumes whatever
 * provider the factory seeded — it never selects or constructs one itself,
 * and it never reads deployment env. The deploy entry maps env vars onto a
 * provider instance.
 */

/** Minimal command result shape the repo materializer depends on. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Minimal live-sandbox surface the github machinery needs: an id, a way to
 * start it, a way to learn the provider's reattach id, and command execution.
 */
export interface MaterializationSandbox {
  readonly id: string;
  start(): Promise<void>;
  getInfo(): Promise<{ metadata?: Record<string, unknown> }>;
  executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<SandboxCommandResult>;
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}

/** Options for building (or reattaching) one sandbox. */
export interface SandboxCreateOptions {
  /** Reattach to this existing provider VM instead of provisioning a new one. */
  providerSandboxId?: string;
  /** Environment variables baked into the sandbox. */
  env?: Record<string, string>;
  /** Idle teardown window (minutes). The provider stops the VM after this idle period. */
  idleTimeoutMinutes?: number;
}

/**
 * A sandbox provider the factory can be configured with.
 *
 * Implementations must be constructible without I/O — provisioning happens in
 * `create(...)` + `sandbox.start()`, never in the constructor.
 */
export interface WebSandboxProvider {
  /**
   * Provider discriminator (`'railway'`, `'local'`, or a custom name). Shown
   * in diagnostics and persisted on project rows so re-opens know which
   * provider owns a stored sandbox id.
   */
  readonly kind: string;
  /**
   * Idle teardown window for provisioned sandboxes, in minutes. The consumer
   * defaults to 30 when omitted.
   */
  readonly idleMinutes?: number;
  /**
   * Per-replica cap on concurrently provisioned sandboxes. `0`/omitted means
   * unlimited. A lightweight per-process budget, not a cross-replica scheduler.
   */
  readonly maxSandboxes?: number;
  /**
   * Whether the provider is usable as configured. `false` keeps GitHub-backed
   * projects off and surfaces "disabled" in the feature diagnostics instead of
   * failing at first use (e.g. Railway selected without a token).
   */
  isEnabled(): boolean;
  /** Build a (not-yet-started) sandbox, or reattach when `providerSandboxId` is set. */
  create(opts: SandboxCreateOptions): MaterializationSandbox;
  /**
   * The in-sandbox working directory a repo checks out into. Server-side only;
   * never derived from client input.
   */
  workdirFor(repoFullName: string): string;
}

/** The repo directory name for a `owner/name` full name. */
export function repoDirName(repoFullName: string): string {
  return repoFullName.split('/').pop() || 'repo';
}
