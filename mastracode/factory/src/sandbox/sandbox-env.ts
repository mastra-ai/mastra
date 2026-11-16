/**
 * Sandbox environment variables: what a session sandbox's commands and builds
 * get from the Factory's stored variables, and how a running sandbox picks up
 * edits on its next command.
 */

import type { FactorySandboxContext } from '@mastra/core/workspace';
import type { SandboxEnvStore } from '../storage/domains/sandbox-envs/base.js';

export interface SandboxEnv {
  /** Variables every command in the sandbox gets. */
  runtime: Record<string, string>;
  /** Variables template builds and Factory-run setup commands get; never runtime commands. */
  build: Record<string, string>;
  /** Read before the values: an edit landing in between makes the next check reload. */
  revision: string;
  buildRevision: string;
}

/**
 * The single place a sandbox's environment is resolved. v1 reads only the
 * Factory-wide variables; personal and session layers merge in here later,
 * with session over personal over Factory, so callers never change.
 */
export async function resolveSandboxEnv(
  store: Pick<SandboxEnvStore, 'resolve'>,
  scope: { orgId: string; projectId: string },
): Promise<SandboxEnv> {
  const { runtime, build, revision, buildRevision } = await store.resolve(scope.orgId, scope.projectId);
  return { runtime, build, revision, buildRevision };
}

function warnReadFailed(message: string, error: unknown) {
  console.warn(`[Mastra Factory] ${message}`, {
    // Storage and decryption errors name no values.
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * `resolveSandboxEnv` for session boot and setup: a failed read (a storage
 * blip, a value encrypted with a removed key) is logged and yields no Factory
 * variables, so it can't stop a session from starting. Its empty revision
 * makes the first command's refresh try again.
 */
export async function resolveSandboxEnvOrEmpty(
  store: Pick<SandboxEnvStore, 'resolve'>,
  scope: { orgId: string; projectId: string },
): Promise<SandboxEnv> {
  try {
    return await resolveSandboxEnv(store, scope);
  } catch (error) {
    warnReadFailed('Could not read sandbox environment variables; starting without them', error);
    return { runtime: {}, build: {}, revision: '', buildRevision: '' };
  }
}

/**
 * The template-build fields of a sandbox context. Omitted when the Factory has
 * no Build variables, so the template identity matches one built without them.
 * Session boot and environment builds share this, so both name the same template.
 */
export function sandboxBuildContext(
  env: SandboxEnv | undefined,
): Pick<FactorySandboxContext, 'buildEnv' | 'buildEnvRevision'> {
  if (!env || Object.keys(env.build).length === 0) return {};
  return { buildEnv: env.build, buildEnvRevision: env.buildRevision };
}

/**
 * Replace every Build value that appears in provider or command output with
 * `***`. Each value is also matched without its edge whitespace, since output
 * often drops a pasted trailing space or newline. Longest first, so a value
 * that contains another is masked whole.
 */
export function maskSandboxEnvValues(text: string, env: Record<string, string> | undefined): string {
  if (!env) return text;
  const values = new Set(Object.values(env).flatMap(value => [value, value.trim()]));
  let masked = text;
  for (const value of [...values].sort((a, b) => b.length - a.length)) {
    if (value) masked = masked.replaceAll(value, '***');
  }
  return masked;
}

type EnvOverlay = Record<string, string | undefined>;

const appliedBySandbox = new WeakMap<object, () => Record<string, string>>();

/**
 * The Factory runtime values currently applied to a sandbox, so output from a
 * command that ran in it (a failed teardown) can be masked without a storage read.
 */
export function appliedSandboxEnv(sandbox: object): Record<string, string> {
  return appliedBySandbox.get(sandbox)?.() ?? {};
}

export interface RefreshableSandbox {
  ensureRunning?: () => Promise<void>;
  setEnv?: (update: (env: EnvOverlay) => EnvOverlay) => void;
}

/**
 * Apply the Factory's runtime variables to a sandbox's env overlay and keep
 * them current: after every `ensureRunning()` (which every command path awaits
 * before reading the overlay) the Factory revision is checked, and on a change
 * the variables are reloaded and re-applied, so an add, edit or delete reaches
 * the next command. Processes already running keep the env they started with.
 *
 * A key the sandbox already had (its host `env`) is remembered before Factory
 * first writes it and restored when the Factory variable goes away. A refresh
 * that fails is logged and the command runs with the env last applied.
 */
export function attachSandboxEnvRefresh(
  sandbox: RefreshableSandbox,
  options: {
    initial: Pick<SandboxEnv, 'runtime' | 'revision'>;
    revision: () => Promise<string>;
    load: () => Promise<Pick<SandboxEnv, 'runtime' | 'revision'>>;
    onError?: (error: unknown) => void;
  },
): void {
  const setEnv = sandbox.setEnv?.bind(sandbox);
  if (!setEnv) return;
  // Values the overlay held under a key before Factory first wrote it.
  const shadowed = new Map<string, string | undefined>();
  let applied: Record<string, string> = {};
  let appliedRevision = options.initial.revision;

  const apply = (next: Record<string, string>) => {
    setEnv(env => {
      const out = { ...env };
      for (const key of Object.keys(applied)) {
        if (Object.hasOwn(next, key)) continue;
        const previous = shadowed.get(key);
        shadowed.delete(key);
        if (previous === undefined) delete out[key];
        else out[key] = previous;
      }
      for (const [key, value] of Object.entries(next)) {
        if (!Object.hasOwn(applied, key)) shadowed.set(key, env[key]);
        out[key] = value;
      }
      return out;
    });
    applied = { ...next };
  };
  apply(options.initial.runtime);
  appliedBySandbox.set(sandbox, () => applied);

  const original = sandbox.ensureRunning?.bind(sandbox);
  if (!original) return;
  let inFlight: Promise<void> | undefined;
  // Never calls ensureRunning itself, so a command inside `onStart` can't wait on its own start.
  const refresh = async () => {
    if ((await options.revision()) === appliedRevision) return;
    const next = await options.load();
    apply(next.runtime);
    appliedRevision = next.revision;
  };
  sandbox.ensureRunning = async () => {
    await original();
    inFlight ??= refresh()
      .catch(error => {
        if (options.onError) options.onError(error);
        else warnReadFailed('Could not refresh sandbox environment variables; using the last applied', error);
      })
      .finally(() => {
        inFlight = undefined;
      });
    await inFlight;
  };
}
