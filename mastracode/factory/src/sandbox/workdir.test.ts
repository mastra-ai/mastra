import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeLocalSessionDir,
  computeLocalWorkdir,
  computeRemoteWorkdir,
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

describe('computeLocalWorkdir', () => {
  const root = path.resolve('/srv/sandboxes');

  it('nests repo under the session directory so the sentinel sits beside the clone', () => {
    expect(computeLocalWorkdir(root, 'sess-1', 'acme/api')).toBe(path.join(root, 'sess-1', 'api'));
    expect(computeLocalSessionDir(root, 'sess-1')).toBe(path.join(root, 'sess-1'));
  });

  it('keeps same-name repos apart per session', () => {
    expect(computeLocalWorkdir(root, 'sess-a', 'acme/api')).not.toBe(computeLocalWorkdir(root, 'sess-b', 'acme/api'));
  });

  it('refuses escapes through hostile session ids or repo names', () => {
    // Sanitization neutralizes traversal rather than throwing.
    expect(computeLocalWorkdir(root, '../../sess', 'acme/api').startsWith(root + path.sep)).toBe(true);
    expect(computeLocalWorkdir(root, 'sess', 'acme/../../..').startsWith(root + path.sep)).toBe(true);
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
