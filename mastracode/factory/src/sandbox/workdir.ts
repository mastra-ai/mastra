import * as path from 'node:path';

/**
 * Session workdir derivation. Workdirs are never persisted or trusted from
 * storage or client input — the stale-workdir class of production bugs came
 * from reading `session.sandboxWorkdir` written under a different provider.
 *
 * Local sandboxes derive their workdir synchronously from the sandbox's own
 * `workingDirectory` (the per-session directory the deploy's callback chose).
 * Remote sandboxes have no invented path: the repo clones into the VM's own
 * default cwd (its home dir), so the workdir is only knowable once a VM is
 * running — resolved lazily by `resolveSessionWorkdir` via a one-time `pwd`
 * probe and memoized on the session entry.
 */

/** Keep each path piece a single safe segment (no separators or traversal). */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned || 'repo';
}

/**
 * Synchronously derivable workdir: local sandboxes expose their host
 * `workingDirectory`; the repo checks out as a contained subdirectory so the
 * setup marker sits beside the clone instead of polluting `git status`
 * inside it. Returns undefined for remote providers, whose workdir is a
 * runtime fact of the VM (`<home>/<repo>`).
 */
export function deriveLocalWorkdir(
  sandbox: { provider: string; workingDirectory?: unknown },
  repoFullName: string,
): string | undefined {
  const wd = sandbox.workingDirectory;
  if (sandbox.provider === 'local' && typeof wd === 'string' && wd.length > 0) {
    return resolveContainedLocalWorkdir(wd, repoSubdirName(repoFullName));
  }
  return undefined;
}

/** Derive `<workingDirectory>/<repo>` when a remote sandbox declares an absolute root. */
export function deriveRemoteRepoDir(
  sandbox: { provider: string; workingDirectory?: unknown },
  repoFullName: string,
): string | undefined {
  const wd = sandbox.workingDirectory;
  if (sandbox.provider !== 'local' && typeof wd === 'string' && wd.startsWith('/')) {
    return repoDirUnder(wd, repoFullName);
  }
  return undefined;
}

/** Join a parent directory and sanitized repository name. */
export function repoDirUnder(parent: string, repoFullName: string): string {
  let end = parent.length;
  while (end > 0 && parent[end - 1] === '/') end--;
  return `${parent.slice(0, end)}/${repoSubdirName(repoFullName)}`;
}

/**
 * The repo checkout's directory name under the working directory. Every
 * workdir derivation path produces this same segment, so repo-relative paths
 * (skill roots, agent-visible `<repo>/...` spellings) can be built without
 * resolving the full workdir.
 */
export function repoSubdirName(repoFullName: string): string {
  const [, name] = repoFullName.split('/', 2);
  return sanitizeSegment(name || 'repo');
}

/**
 * The sandbox's declared absolute `workingDirectory`, if any. LocalSandbox
 * always answers (its getter is narrowed to `string`); remote providers only
 * answer when the deploy configured one. Remote providers never expand
 * `~`/`$HOME`, so non-absolute values fall through to the runtime fallback
 * instead of becoming a bogus root. Trailing slashes are trimmed.
 */
export function declaredWorkingDirectory(sandbox: { workingDirectory?: unknown }): string | undefined {
  const wd = sandbox.workingDirectory;
  if (typeof wd !== 'string' || !wd.startsWith('/')) return undefined;
  let end = wd.length;
  while (end > 1 && wd[end - 1] === '/') end--;
  return wd.slice(0, end);
}

/**
 * The session's working directory: the parent directory repos clone into and
 * the root for the agent's file tools. A declared `workingDirectory` names it
 * outright; otherwise it degrades to the parent of the resolved workdir, so
 * sandboxes with no declared workingDirectory keep exactly the pre-split
 * layout (`<home>` on the probed remote path, the local sandbox root locally).
 */
export function workingDirectoryFor(sandbox: { workingDirectory?: unknown }, workdir: string): string {
  return declaredWorkingDirectory(sandbox) ?? path.posix.dirname(workdir);
}

/** Resolve a workdir under `root`, refusing any path that escapes the configured root. */
export function resolveContainedLocalWorkdir(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && resolved.startsWith(`${resolvedRoot}${path.sep}`)) return resolved;
  throw new Error(`Refusing to use local sandbox path outside configured root: ${resolved}`);
}
