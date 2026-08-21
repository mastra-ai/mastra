import * as path from 'node:path';

/**
 * Deterministic session workdir computation. Workdirs are always computed
 * from intent (session id + repo full name) and never persisted or trusted
 * from storage or client input — the stale-workdir class of production bugs
 * came from reading `session.sandboxWorkdir` written under a different
 * provider.
 */

/** Keep each path piece a single safe segment (no separators or traversal). */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned || 'repo';
}

/**
 * In-sandbox base directory for remote (VM-per-session) providers. Absolute
 * rather than home-relative: `$HOME` differs per provider and cannot be
 * resolved before the VM starts, while every exec path (shell quoting, cwd
 * options, filesystem ids) assumes a fixed absolute string. Matches current
 * production layout; provider templates ensure it is writable.
 */
export const REMOTE_WORKDIR_BASE = '/workspace';

/**
 * In-sandbox working directory for a remote (VM-per-session) provider:
 * `/workspace/<owner>/<repo>`.
 */
export function computeRemoteWorkdir(repoFullName: string): string {
  const [owner, name] = repoFullName.split('/', 2);
  return `${REMOTE_WORKDIR_BASE}/${sanitizeSegment(owner || 'unknown')}/${sanitizeSegment(name || 'repo')}`;
}

/**
 * Derive the checkout workdir from a constructed sandbox instance. Local
 * sandboxes expose their host `workingDirectory` (the per-session directory
 * the deploy's callback chose — e.g. `<root>/<sessionId>`); the repo checks
 * out as a contained subdirectory so the setup marker sits beside the clone
 * instead of polluting `git status` inside it. Every other provider gets the
 * deterministic remote layout. Never persisted, never trusted from storage
 * or client input.
 */
export function deriveSandboxWorkdir(
  sandbox: { provider: string; workingDirectory?: unknown },
  repoFullName: string,
): string {
  const wd = sandbox.workingDirectory;
  if (sandbox.provider === 'local' && typeof wd === 'string' && wd.length > 0) {
    const [, name] = repoFullName.split('/', 2);
    return resolveContainedLocalWorkdir(wd, sanitizeSegment(name || 'repo'));
  }
  return computeRemoteWorkdir(repoFullName);
}

/** Resolve a workdir under `root`, refusing any path that escapes the configured root. */
export function resolveContainedLocalWorkdir(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && resolved.startsWith(`${resolvedRoot}${path.sep}`)) return resolved;
  throw new Error(`Refusing to use local sandbox path outside configured root: ${resolved}`);
}
