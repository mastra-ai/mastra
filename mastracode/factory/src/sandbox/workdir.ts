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
 * Host checkout directory for a local-provider session:
 * `<localRoot>/<session-id>/<repo-name>`. The session directory
 * (`<localRoot>/<session-id>`) is the sandbox's working directory — the repo
 * is a subdirectory so the bootstrap sentinel sits beside the clone instead
 * of polluting `git status` inside it. Refuses any path that escapes the
 * configured root.
 */
export function computeLocalWorkdir(localRoot: string, sessionId: string, repoFullName: string): string {
  const [, name] = repoFullName.split('/', 2);
  return resolveContainedLocalWorkdir(localRoot, sanitizeSegment(sessionId), sanitizeSegment(name || 'repo'));
}

/** Host session directory for a local-provider session: `<localRoot>/<session-id>`. */
export function computeLocalSessionDir(localRoot: string, sessionId: string): string {
  return resolveContainedLocalWorkdir(localRoot, sanitizeSegment(sessionId));
}

/** Resolve a workdir under `root`, refusing any path that escapes the configured root. */
export function resolveContainedLocalWorkdir(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && resolved.startsWith(`${resolvedRoot}${path.sep}`)) return resolved;
  throw new Error(`Refusing to use local sandbox path outside configured root: ${resolved}`);
}
