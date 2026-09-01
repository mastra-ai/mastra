import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveLocalRepoDir, repoDirUnder, resolveContainedLocalRepoDir, sanitizeSegment } from './repo-dir.js';

describe('sanitizeSegment', () => {
  it('keeps safe characters and replaces separators and traversal', () => {
    expect(sanitizeSegment('acme')).toBe('acme');
    expect(sanitizeSegment('My_Repo.v2-x')).toBe('My_Repo.v2-x');
    expect(sanitizeSegment('a/b\\c')).toBe('a-b-c');
    // Slashes become dashes and leading dots are stripped — the remaining
    // interior dots are harmless inside a single path segment.
    expect(sanitizeSegment('../../etc')).toBe('-..-etc');
  });

  it('strips leading dots so segments cannot be hidden or traversal', () => {
    expect(sanitizeSegment('..')).toBe('repo');
    expect(sanitizeSegment('.git')).toBe('git');
  });

  it('never returns an empty segment', () => {
    expect(sanitizeSegment('')).toBe('repo');
    expect(sanitizeSegment('...')).toBe('repo');
  });
});

describe('repoDirUnder', () => {
  it('nests the sanitized repo name under the probed home', () => {
    expect(repoDirUnder('/home/user', 'acme/api')).toBe('/home/user/api');
    expect(repoDirUnder('/home/daytona', 'acme/api')).toBe('/home/daytona/api');
  });

  it('tolerates a trailing slash on the probed home', () => {
    expect(repoDirUnder('/home/user/', 'acme/api')).toBe('/home/user/api');
  });

  it('sanitizes hostile repo names into a single segment', () => {
    // The name piece is `..` → traversal neutralized to the fallback segment.
    expect(repoDirUnder('/home/user', 'acme/../../..')).toBe('/home/user/repo');
    expect(repoDirUnder('/home/user', 'api')).toBe('/home/user/repo');
  });
});

describe('deriveLocalRepoDir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('nests the repo under a local sandbox workingDirectory so the marker sits beside the clone', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess-1') };
    expect(deriveLocalRepoDir(sandbox, 'acme/api')).toBe(path.join(root, 'sess-1', 'api'));
  });

  it('keeps same-name repos apart when callbacks use per-session directories', () => {
    const a = { provider: 'local', workingDirectory: path.join(root, 'sess-a') };
    const b = { provider: 'local', workingDirectory: path.join(root, 'sess-b') };
    expect(deriveLocalRepoDir(a, 'acme/api')).not.toBe(deriveLocalRepoDir(b, 'acme/api'));
  });

  it('refuses escapes through hostile repo names', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess') };
    // Sanitization neutralizes traversal rather than throwing.
    expect(deriveLocalRepoDir(sandbox, 'acme/../../..')!.startsWith(root + path.sep)).toBe(true);
  });

  it('answers undefined for remote providers — their repoDir is a runtime fact of the VM', () => {
    expect(deriveLocalRepoDir({ provider: 'e2b' }, 'acme/api')).toBeUndefined();
    expect(deriveLocalRepoDir({ provider: 'platform', workingDirectory: undefined }, 'acme/api')).toBeUndefined();
  });

  it('answers undefined for a local sandbox without a usable workingDirectory', () => {
    expect(deriveLocalRepoDir({ provider: 'local', workingDirectory: '' }, 'acme/api')).toBeUndefined();
  });
});

describe('resolveContainedLocalRepoDir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('resolves nested segments under the root', () => {
    expect(resolveContainedLocalRepoDir(root, 'a', 'b')).toBe(path.join(root, 'a', 'b'));
  });

  it('throws when the resolved path escapes the root', () => {
    expect(() => resolveContainedLocalRepoDir(root, '..', 'outside')).toThrow(/outside configured root/);
    expect(() => resolveContainedLocalRepoDir(root)).toThrow(/outside configured root/);
  });
});
