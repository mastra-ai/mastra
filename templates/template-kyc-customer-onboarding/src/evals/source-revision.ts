import { execFileSync } from 'node:child_process';

export const resolveSourceRevision = (directory: string): string => {
  try {
    const revision = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(revision)) return revision;
  } catch {
    // Scaffolding and downloaded archives need not contain a Git commit.
  }
  return 'unversioned';
};
