import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeRemoteWorkdir,
  deriveSandboxWorkdir,
  resolveContainedLocalWorkdir,
  sanitizeSegment,
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

describe('computeRemoteWorkdir', () => {
  it('nests owner/repo under the remote base', () => {
    expect(computeRemoteWorkdir('acme/api')).toBe('/workspace/acme/api');
  });

  it('sanitizes hostile repo names', () => {
    // `..` owner collapses to the fallback segment; the name keeps only its first piece.
    expect(computeRemoteWorkdir('../etc/passwd')).toBe('/workspace/repo/etc');
  });

  it('tolerates a bare name without an owner', () => {
    expect(computeRemoteWorkdir('api')).toBe('/workspace/api/repo');
  });
});

describe('deriveSandboxWorkdir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('nests the repo under a local sandbox workingDirectory so the marker sits beside the clone', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess-1') };
    expect(deriveSandboxWorkdir(sandbox, 'acme/api')).toBe(path.join(root, 'sess-1', 'api'));
  });

  it('keeps same-name repos apart when callbacks use per-session directories', () => {
    const a = { provider: 'local', workingDirectory: path.join(root, 'sess-a') };
    const b = { provider: 'local', workingDirectory: path.join(root, 'sess-b') };
    expect(deriveSandboxWorkdir(a, 'acme/api')).not.toBe(deriveSandboxWorkdir(b, 'acme/api'));
  });

  it('refuses escapes through hostile repo names', () => {
    const sandbox = { provider: 'local', workingDirectory: path.join(root, 'sess') };
    // Sanitization neutralizes traversal rather than throwing.
    expect(deriveSandboxWorkdir(sandbox, 'acme/../../..').startsWith(root + path.sep)).toBe(true);
  });

  it('uses the deterministic remote layout for non-local providers', () => {
    expect(deriveSandboxWorkdir({ provider: 'e2b' }, 'acme/api')).toBe('/workspace/acme/api');
    expect(deriveSandboxWorkdir({ provider: 'platform', workingDirectory: undefined }, 'acme/api')).toBe(
      '/workspace/acme/api',
    );
  });

  it('falls back to the remote layout for a local sandbox without a usable workingDirectory', () => {
    expect(deriveSandboxWorkdir({ provider: 'local', workingDirectory: '' }, 'acme/api')).toBe('/workspace/acme/api');
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
