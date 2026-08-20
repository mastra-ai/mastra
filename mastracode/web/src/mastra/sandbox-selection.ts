/**
 * Session sandbox selection for the web host, in precedence order:
 * 1. Platform identity trio set → `PlatformSandbox` (managed deployments).
 * 2. `E2B_API_KEY` set → `E2BSandbox` with a sha-aliased lazy-built repo
 *    template (repo cloned + deps installed at the known default-branch
 *    head), pausing on idle and resuming by id.
 * 3. Neither → `LocalSandbox` for single-user development.
 *
 * Every branch keys the sandbox by session id (id-keyed getOrCreate on
 * `start()`), forwards factory's `ctx.onStart` setup hook so session setup
 * runs inside the start lifecycle, and constructs lazily — nothing
 * provisions a VM until a tool actually needs one.
 */
import { join } from 'node:path';
import { LocalSandbox } from '@mastra/core/workspace';
import { E2BSandbox, createRepoTemplate } from '@mastra/e2b';
import { PlatformSandbox } from '@mastra/platform-workspace';
import type { InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';
import type { FactorySandboxContext, MastraFactorySandboxConfig } from '@mastra/factory';

export const PLATFORM_SANDBOX_ENV_KEYS = [
  'MASTRA_ENVIRONMENT_ID',
  'MASTRA_PROJECT_ID',
  'MASTRA_PLATFORM_SECRET_KEY',
] as const;

export interface SandboxSelectionOptions {
  /** Environment to read gating keys from (the process env in production). */
  env: Record<string, string | undefined>;
  /** Host root for local session checkouts. */
  localRoot: string;
  /** Allow-listed env forwarded into local sandboxes. */
  localEnv: () => Record<string, string>;
  /** Platform private-network registry — only constructed for the platform branch. */
  addressRegistry?: InProcessSandboxAddressRegistry;
}

export function hasPlatformSandboxEnv(env: Record<string, string | undefined>): boolean {
  return PLATFORM_SANDBOX_ENV_KEYS.every(key => Boolean(env[key]?.trim()));
}

export function selectSandboxConfig(options: SandboxSelectionOptions): MastraFactorySandboxConfig {
  const { env, localRoot, localEnv, addressRegistry } = options;

  if (hasPlatformSandboxEnv(env)) {
    return {
      create: (ctx: FactorySandboxContext) =>
        new PlatformSandbox({
          id: ctx.sessionId,
          addressRegistry,
          idleTimeoutMinutes: ctx.idleTimeoutMinutes,
          ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
        }),
    };
  }

  if (env.E2B_API_KEY?.trim()) {
    return {
      create: (ctx: FactorySandboxContext) =>
        new E2BSandbox({
          id: ctx.sessionId,
          // Sha-aliased lazy template: repo cloned + setup run at the known
          // default-branch head. Sha unknown → sha-less alias; build failure
          // → default template + runtime cold clone (never a wedged session).
          ...(ctx.repoFullName
            ? {
                template: createRepoTemplate({
                  repoFullName: ctx.repoFullName,
                  ...(ctx.repoSha ? { sha: ctx.repoSha } : {}),
                  ...(ctx.setupCommand ? { setupCommand: ctx.setupCommand } : {}),
                  workdir: ctx.workdir,
                }),
              }
            : {}),
          // E2B pauses (not destroys) on timeout and resumes on reconnect.
          timeout: ctx.idleTimeoutMinutes * 60_000,
          ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
        }),
    };
  }

  return {
    localRoot,
    create: (ctx: FactorySandboxContext) =>
      new LocalSandbox({
        // Rooted at the per-session directory (parent of the checkout) so
        // the setup marker sits beside the clone, not inside it.
        workingDirectory: join(localRoot, ctx.sessionId),
        env: localEnv(),
        ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
      }),
  };
}
