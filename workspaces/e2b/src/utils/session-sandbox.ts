/**
 * Session-sandbox preset for hosts that construct one E2B sandbox per
 * session (e.g. a Mastra Factory `sandbox` callback).
 *
 * The returned callback keys the sandbox by session id (id-keyed getOrCreate
 * on `start()` — reconnect/resume an existing VM, create otherwise), uses a
 * sha-aliased lazy-built repo template when the session carries a repo
 * (see `createRepoTemplate`), pauses on idle, and forwards the host's
 * `onStart` setup hook so session setup runs inside the start lifecycle.
 *
 * The context type is structural on purpose: any host that supplies these
 * fields can use the preset without this package depending on it.
 */
import type { SandboxLifecycleHook } from '@mastra/core/workspace';

import { E2BSandbox } from '../sandbox';
import { createRepoTemplate } from './repo-template';
import type { TemplateSpec } from './template';

/** The per-session intent a host hands the preset's callback. */
export interface E2BSessionSandboxContext {
  /** Logical sandbox identity — the session id. */
  sessionId: string;
  /** GitHub `owner/repo` slug, when the session is repo-backed. */
  repoFullName?: string;
  /** Default-branch head sha for template pinning, when known. */
  repoSha?: string;
  /** Repo setup command, hashed into the template alias. */
  setupCommand?: string;
  /** Host-built setup hook, run inside the start lifecycle. */
  onStart?: SandboxLifecycleHook;
}

export interface E2BSessionSandboxOptions {
  /**
   * Minutes of inactivity before E2B pauses the sandbox (it resumes by id
   * on the next start). Defaults to 30.
   */
  idleTimeoutMinutes?: number;
  /**
   * Override the template entirely. When set, the sha-aliased repo template
   * derivation is skipped and this spec is used for every session.
   */
  template?: TemplateSpec;
}

/**
 * Build a `(ctx) => E2BSandbox` session-sandbox callback.
 *
 * @example
 * ```typescript
 * new MastraFactory({ sandbox: e2bSessionSandbox() });
 * // or with overrides:
 * new MastraFactory({ sandbox: e2bSessionSandbox({ idleTimeoutMinutes: 60 }) });
 * ```
 */
export function e2bSessionSandbox(options: E2BSessionSandboxOptions = {}) {
  const { idleTimeoutMinutes = 30, template } = options;
  return (ctx: E2BSessionSandboxContext): E2BSandbox => {
    const resolvedTemplate =
      template ??
      (ctx.repoFullName
        ? // Sha-aliased lazy template: repo cloned + setup run at the known
          // default-branch head. Sha unknown → sha-less alias; build failure
          // → fallback template + runtime cold clone (never a wedged session).
          createRepoTemplate({
            repoFullName: ctx.repoFullName,
            ...(ctx.repoSha ? { sha: ctx.repoSha } : {}),
            ...(ctx.setupCommand ? { setupCommand: ctx.setupCommand } : {}),
          })
        : undefined);
    return new E2BSandbox({
      id: ctx.sessionId,
      ...(resolvedTemplate ? { template: resolvedTemplate } : {}),
      // E2B pauses (not destroys) on timeout and resumes on reconnect.
      timeout: idleTimeoutMinutes * 60_000,
      ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
    });
  };
}
