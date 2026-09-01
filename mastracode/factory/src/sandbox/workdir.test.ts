import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  declaredWorkingDirectory,
  deriveLocalWorkdir,
  repoDirUnder,
  repoSubdirName,
  resolveContainedLocalWorkdir,
  sanitizeSegment,
  workingDirectoryFor,
} from './workdir.js';

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

describe('deriveLocalWorkdir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('nests the repo under a local sandbox workingDirectory so the marker sits beside the clone', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess-1') };
    expect(deriveLocalWorkdir(sandbox, 'acme/api')).toBe(path.join(root, 'sess-1', 'api'));
  });

  it('keeps same-name repos apart when callbacks use per-session directories', () => {
    const a = { provider: 'local', workingDirectory: path.join(root, 'sess-a') };
    const b = { provider: 'local', workingDirectory: path.join(root, 'sess-b') };
    expect(deriveLocalWorkdir(a, 'acme/api')).not.toBe(deriveLocalWorkdir(b, 'acme/api'));
  });

  it('refuses escapes through hostile repo names', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess') };
    // Sanitization neutralizes traversal rather than throwing.
    expect(deriveLocalWorkdir(sandbox, 'acme/../../..')!.startsWith(root + path.sep)).toBe(true);
  });

  it('answers undefined for remote providers — their workdir is a runtime fact of the VM', () => {
    expect(deriveLocalWorkdir({ provider: 'e2b' }, 'acme/api')).toBeUndefined();
    expect(deriveLocalWorkdir({ provider: 'platform', workingDirectory: undefined }, 'acme/api')).toBeUndefined();
  });

  it('answers undefined for a local sandbox without a usable workingDirectory', () => {
    expect(deriveLocalWorkdir({ provider: 'local', workingDirectory: '' }, 'acme/api')).toBeUndefined();
  });
});

describe('resolveContainedLocalWorkdir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('resolves nested segments under the root', () => {
    expect(resolveContainedLocalWorkdir(root, 'a', 'b')).toBe(path.join(root, 'a', 'b'));
  });

  it('throws when the resolved path escapes the root', () => {
    expect(() => resolveContainedLocalWorkdir(root, '..', 'outside')).toThrow(/outside configured root/);
    expect(() => resolveContainedLocalWorkdir(root)).toThrow(/outside configured root/);
  });
});

describe('repoSubdirName', () => {
  it('is the sanitized repo name every workdir derivation nests under its parent', () => {
    expect(repoSubdirName('octocat/hello-world')).toBe('hello-world');
    expect(repoSubdirName('octocat/..evil')).toBe('evil');
    expect(repoDirUnder('/workspace', 'octocat/hello')).toBe(`/workspace/${repoSubdirName('octocat/hello')}`);
  });

  it('falls back to a safe segment when the name is missing', () => {
    expect(repoSubdirName('octocat')).toBe('repo');
  });
});

describe('declaredWorkingDirectory', () => {
  it('answers an absolute declared workingDirectory, trimming trailing slashes', () => {
    expect(declaredWorkingDirectory({ workingDirectory: '/workspace' })).toBe('/workspace');
    expect(declaredWorkingDirectory({ workingDirectory: '/workspace///' })).toBe('/workspace');
  });

  it('keeps the filesystem root itself intact', () => {
    expect(declaredWorkingDirectory({ workingDirectory: '/' })).toBe('/');
  });

  it('ignores undeclared and non-absolute values since remote providers never expand ~ or $HOME', () => {
    expect(declaredWorkingDirectory({})).toBeUndefined();
    expect(declaredWorkingDirectory({ workingDirectory: undefined })).toBeUndefined();
    expect(declaredWorkingDirectory({ workingDirectory: '~/repos' })).toBeUndefined();
    expect(declaredWorkingDirectory({ workingDirectory: '$HOME/repos' })).toBeUndefined();
    expect(declaredWorkingDirectory({ workingDirectory: '' })).toBeUndefined();
  });
});

describe('workingDirectoryFor', () => {
  it('prefers the declared workingDirectory', () => {
    expect(workingDirectoryFor({ workingDirectory: '/workspace' }, '/workspace/mastra')).toBe('/workspace');
  });

  it('degrades to the parent of the workdir when nothing is declared (pre-split behavior)', () => {
    expect(workingDirectoryFor({}, '/home/user/mastra')).toBe('/home/user');
  });

  it('handles a root-level workdir on the fallback path', () => {
    expect(workingDirectoryFor({}, '/mastra')).toBe('/');
  });
});
