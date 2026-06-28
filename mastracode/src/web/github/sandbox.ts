/**
 * Sandbox provisioning + repo materialization for GitHub-backed projects.
 *
 * A GitHub repo is never cloned onto the server host. Instead each project gets
 * its own isolated cloud sandbox (a `MastraSandbox`, e.g. a Railway VM) and the
 * repo is cloned *inside* that sandbox. The agent's file tools and command tools
 * then operate entirely against the remote checkout.
 *
 * - `ensureProjectSandbox(row)` provisions a new sandbox (persisting its provider
 *   id so re-opens reattach) or reattaches to the stored one.
 * - `materializeRepo(row, token)` runs `git clone` (first open) or `git pull`
 *   (re-open) inside the sandbox, using a short-lived installation token that is
 *   scrubbed from the git remote afterwards so it never persists in the VM.
 *
 * The Railway sandbox is constructed behind a swappable factory so tests can
 * inject a fake sandbox and other providers can be added later.
 */

import { RailwaySandbox } from '@mastra/railway';
import { eq } from 'drizzle-orm';
import { getAppDb } from './db';
import { githubProjects } from './schema';
import type { GithubProjectRow } from './schema';

/** Minimal command result shape we depend on. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Minimal live-sandbox surface this module needs: an id, a way to start it, a
 * way to learn the provider's reattach id, and command execution.
 */
export interface MaterializationSandbox {
  readonly id: string;
  start(): Promise<void>;
  getInfo(): Promise<{ metadata?: Record<string, unknown> }>;
  executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<SandboxCommandResult>;
}

/**
 * Factory that builds a (not-yet-started) sandbox. When `providerSandboxId` is
 * provided the sandbox should reattach to that existing VM instead of
 * provisioning a new one.
 */
export type SandboxFactory = (opts: {
  providerSandboxId?: string;
  env?: Record<string, string>;
}) => MaterializationSandbox;

/**
 * Default sandbox provider id. Today only Railway is wired; the factory keeps
 * this swappable.
 */
export function getSandboxProvider(): string {
  return process.env.MASTRACODE_SANDBOX_PROVIDER || 'railway';
}

/**
 * True when a sandbox provider is configured. Required to *open* a GitHub repo
 * project (connecting/picking repos works without it).
 */
export function isSandboxEnabled(): boolean {
  const provider = getSandboxProvider();
  if (provider === 'railway') {
    return Boolean(process.env.RAILWAY_API_TOKEN);
  }
  return false;
}

/**
 * Compute the in-sandbox working directory for a repo. Server-side only; never
 * derived from client input.
 */
export function computeSandboxWorkdir(repoFullName: string): string {
  const base = process.env.MASTRACODE_SANDBOX_WORKDIR;
  const repoName = repoFullName.split('/').pop() || 'repo';
  if (base) {
    // If the configured base already ends with the repo name, use it as-is.
    return base.endsWith(`/${repoName}`) ? base : `${base.replace(/\/$/, '')}/${repoName}`;
  }
  return `/workspace/${repoName}`;
}

/** Default factory: a Railway sandbox, optionally reattaching by id. */
const railwayFactory: SandboxFactory = ({ providerSandboxId, env }) =>
  new RailwaySandbox({
    ...(providerSandboxId ? { sandboxId: providerSandboxId } : {}),
    ...(env ? { env } : {}),
  });

let sandboxFactory: SandboxFactory = railwayFactory;

/** Override the sandbox factory (tests / alternative providers). */
export function setSandboxFactory(factory: SandboxFactory): void {
  sandboxFactory = factory;
}

/** Reset to the default Railway factory. */
export function resetSandboxFactory(): void {
  sandboxFactory = railwayFactory;
}

/**
 * The provider's reattach id for a started sandbox. For Railway this is the
 * underlying `railwaySandboxId` in `getInfo().metadata`.
 */
async function readProviderSandboxId(sandbox: MaterializationSandbox): Promise<string | undefined> {
  const info = await sandbox.getInfo();
  const id = info.metadata?.railwaySandboxId ?? info.metadata?.sandboxId;
  return typeof id === 'string' ? id : undefined;
}

/**
 * Provision a new sandbox (persisting its provider id on first open) or
 * reattach to the stored one. Returns a started, live sandbox.
 */
export async function ensureProjectSandbox(row: GithubProjectRow): Promise<MaterializationSandbox> {
  const sandbox = sandboxFactory({ providerSandboxId: row.sandboxId ?? undefined });
  await sandbox.start();

  if (!row.sandboxId) {
    const providerSandboxId = await readProviderSandboxId(sandbox);
    if (providerSandboxId) {
      await getAppDb()
        .update(githubProjects)
        .set({ sandboxId: providerSandboxId })
        .where(eq(githubProjects.id, row.id));
    }
  }

  return sandbox;
}

/**
 * Reattach to an already-provisioned sandbox by its provider id and start it.
 * Used by the workspace seam when opening a GitHub project that was already
 * materialized (sandbox id + workdir carried on controller state), so no DB
 * round-trip is needed.
 */
export async function reattachProjectSandbox(providerSandboxId: string): Promise<MaterializationSandbox> {
  const sandbox = sandboxFactory({ providerSandboxId });
  await sandbox.start();
  return sandbox;
}

/**
 * Single-quote a string for safe POSIX shell interpolation. Wraps the value in
 * single quotes and escapes any embedded single quote using the canonical
 * close-quote / escaped-quote / reopen-quote sequence (`'\''`). This is the
 * standard POSIX-safe construction and prevents the quoted string from being
 * terminated early.
 */
function shellQuote(value: string): string {
  // Replace each ' with the four-character sequence: ' \ ' '
  return `'` + value.split(`'`).join(`'\\''`) + `'`;
}

/** Run a shell script in the sandbox via `sh -c`. */
async function sh(sandbox: MaterializationSandbox, script: string): Promise<SandboxCommandResult> {
  return sandbox.executeCommand('sh', ['-c', script]);
}

/** Error raised when the sandbox cannot materialize the repo (actionable). */
export class MaterializeError extends Error {
  constructor(
    message: string,
    readonly code: 'git-missing' | 'egress-blocked' | 'clone-failed' | 'pull-failed',
  ) {
    super(message);
    this.name = 'MaterializeError';
  }
}

/**
 * Build the token-auth clone/pull URL for a repo. The token lives only inside
 * this URL and is scrubbed from the remote after the operation.
 */
function tokenUrl(repoFullName: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repoFullName}.git`;
}

function cleanUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

/**
 * Materialize the repo inside its sandbox. Clones on first open, pulls on
 * re-open. Always scrubs the install token from the remote afterwards and sets
 * `materialized_at` in the DB.
 *
 * @param row     the project row (already provisioned via `ensureProjectSandbox`)
 * @param sandbox the live sandbox to run git inside
 * @param token   a freshly minted, short-lived installation access token
 */
export async function materializeRepo(
  row: GithubProjectRow,
  sandbox: MaterializationSandbox,
  token: string,
): Promise<void> {
  const workdir = row.sandboxWorkdir;
  const repo = row.repoFullName;

  // 0. Defense in depth: never build a git command from values that aren't
  // strictly shaped, even if a malformed row reached the DB. Inputs are also
  // validated at the route boundary before storage.
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new MaterializeError(`Refusing to materialize: invalid repo full name '${repo}'.`, 'clone-failed');
  }
  if (!/^[A-Za-z0-9_./-]+$/.test(row.defaultBranch)) {
    throw new MaterializeError(
      `Refusing to materialize: invalid default branch '${row.defaultBranch}'.`,
      'clone-failed',
    );
  }

  // 1. Preflight: git must be installed in the sandbox template.
  const gitVersion = await sh(sandbox, 'git --version');
  if (gitVersion.exitCode !== 0) {
    throw new MaterializeError(
      'git is not installed in the sandbox. The sandbox template must include git.',
      'git-missing',
    );
  }

  const authUrl = tokenUrl(repo, token);

  try {
    if (!row.materializedAt) {
      // 2a. First open: clone the default branch into the workdir.
      const clone = await sh(
        sandbox,
        `git clone --branch ${shellQuote(row.defaultBranch)} ${shellQuote(authUrl)} ${shellQuote(workdir)}`,
      );
      if (clone.exitCode !== 0) {
        throw classifyGitFailure(clone, 'clone-failed');
      }
    } else {
      // 2b. Re-open: refresh remote to the token URL and fast-forward pull.
      const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`);
      if (setUrl.exitCode !== 0) {
        throw new MaterializeError(`Failed to set git remote: ${setUrl.stderr}`, 'pull-failed');
      }
      const pull = await sh(sandbox, `git -C ${shellQuote(workdir)} pull --ff-only`);
      if (pull.exitCode !== 0) {
        throw classifyGitFailure(pull, 'pull-failed');
      }
    }
  } finally {
    // 3. Always scrub the token from the remote so it isn't left in the VM's
    // git config, even when the clone/pull above failed partway through. This
    // is best-effort on the failure path (the workdir may not exist yet after a
    // failed clone); on the success path the scrub must succeed or we surface it.
    await scrubRemote(sandbox, workdir, repo, Boolean(row.materializedAt));
  }

  // 4. Mark materialized.
  await getAppDb().update(githubProjects).set({ materializedAt: new Date() }).where(eq(githubProjects.id, row.id));
}

/**
 * Reset the git remote back to the tokenless URL. On a successful clone/pull the
 * workdir always has a `.git`, so a non-zero exit code here means the token may
 * still be persisted — surface it. On the failure path the workdir may not exist
 * (e.g. a failed clone), so a non-zero exit is tolerated.
 */
async function scrubRemote(
  sandbox: MaterializationSandbox,
  workdir: string,
  repoFullName: string,
  expectGitDir: boolean,
): Promise<void> {
  const result = await sh(
    sandbox,
    `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(cleanUrl(repoFullName))}`,
  );
  if (result.exitCode !== 0 && expectGitDir) {
    throw new MaterializeError(
      `Failed to scrub installation token from git remote: ${result.stderr.trim() || result.stdout.trim()}`,
      'pull-failed',
    );
  }
}

/**
 * Turn a failed git command into an actionable error, detecting the common
 * "cannot reach github.com" egress failure.
 */
function classifyGitFailure(result: SandboxCommandResult, fallback: 'clone-failed' | 'pull-failed'): MaterializeError {
  const stderr = result.stderr || '';
  if (/could not resolve host|failed to connect|network is unreachable|Connection timed out/i.test(stderr)) {
    return new MaterializeError(
      'The sandbox could not reach github.com. The sandbox network must allow outbound egress to github.com.',
      'egress-blocked',
    );
  }
  return new MaterializeError(`git ${fallback === 'clone-failed' ? 'clone' : 'pull'} failed: ${stderr}`, fallback);
}
