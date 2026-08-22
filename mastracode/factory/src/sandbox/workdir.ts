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
    const [, name] = repoFullName.split('/', 2);
    return resolveContainedLocalWorkdir(wd, sanitizeSegment(name || 'repo'));
  }
  return undefined;
}

/** `<home>/<repo>` — where a remote VM's default-cwd clone lands. */
export function remoteWorkdirFromHome(home: string, repoFullName: string): string {
  const [, name] = repoFullName.split('/', 2);
  return `${home.replace(/\/+$/, '')}/${sanitizeSegment(name || 'repo')}`;
}

/** Resolve a workdir under `root`, refusing any path that escapes the configured root. */
export function resolveContainedLocalWorkdir(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && resolved.startsWith(`${resolvedRoot}${path.sep}`)) return resolved;
  throw new Error(`Refusing to use local sandbox path outside configured root: ${resolved}`);
}
