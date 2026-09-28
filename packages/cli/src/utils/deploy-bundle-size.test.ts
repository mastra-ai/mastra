import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  artifactUploadHeaders,
  BUNDLE_WARN_BYTES,
  checkBundleSize,
  largestOutputEntries,
  uploadArtifact,
} from './deploy-bundle-size.js';

let outputDir: string;

beforeEach(async () => {
  outputDir = await mkdtemp(join(tmpdir(), 'bundle-size-'));
  await mkdir(join(outputDir, 'public', 'clone', 'deep'), { recursive: true });
  await writeFile(join(outputDir, 'public', 'clone', 'deep', 'big.bin'), Buffer.alloc(3000));
  await writeFile(join(outputDir, 'index.mjs'), Buffer.alloc(1000));
  await mkdir(join(outputDir, 'node_modules'));
  await writeFile(join(outputDir, 'node_modules', 'huge.bin'), Buffer.alloc(9000));
});

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('largestOutputEntries', () => {
  it('sums directories recursively, sorts by size, and skips node_modules', async () => {
    expect(await largestOutputEntries(outputDir)).toEqual([
      { name: 'public', bytes: 3000 },
      { name: 'index.mjs', bytes: 1000 },
    ]);
  });
});

describe('checkBundleSize', () => {
  it('does nothing at or below the warning threshold', async () => {
    const warn = vi.fn();
    await checkBundleSize({ artifactBytes: BUNDLE_WARN_BYTES, outputDir, warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with the largest entries above the warning threshold', async () => {
    const warn = vi.fn();
    await checkBundleSize({ artifactBytes: BUNDLE_WARN_BYTES + 1, outputDir, warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0]![0] as string;
    expect(message).toContain('100.0 MB');
    expect(message.indexOf('public')).toBeLessThan(message.indexOf('index.mjs'));
    expect(message).not.toContain('node_modules/');
    expect(message).toContain('stray repo clone');
  });

  it('still warns without the listing when the output cannot be inspected', async () => {
    const warn = vi.fn();
    await chmod(join(outputDir, 'public', 'clone'), 0o000);
    try {
      await checkBundleSize({ artifactBytes: BUNDLE_WARN_BYTES + 1, outputDir, warn });
    } finally {
      await chmod(join(outputDir, 'public', 'clone'), 0o755);
    }
    expect(warn).toHaveBeenCalledWith('Deploy bundle is 100.0 MB, which is unusually large.');
  });

  it('only warns, even far above the platform limit', async () => {
    const warn = vi.fn();
    await checkBundleSize({ artifactBytes: 2 * 1024 * 1024 * 1024, outputDir, warn });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('artifactUploadHeaders', () => {
  it('adds content-length-range only when the URL signs it', () => {
    expect(
      artifactUploadHeaders('https://g.example/o?X-Goog-SignedHeaders=host%3Bx-goog-content-length-range', 42),
    ).toEqual({ 'Content-Type': 'application/zip', 'x-goog-content-length-range': '0,42' });
    expect(artifactUploadHeaders('https://g.example/o?X-Goog-SignedHeaders=host', 42)).toEqual({
      'Content-Type': 'application/zip',
    });
    expect(artifactUploadHeaders('https://g.example/o', 42)).toEqual({ 'Content-Type': 'application/zip' });
  });
});

describe('uploadArtifact', () => {
  it('writes file:// URLs to disk without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const target = join(outputDir, 'upload.zip');
    await uploadArtifact(`file://${target}`, Buffer.from('zip'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names the bundle size when the PUT throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));
    await expect(uploadArtifact('https://g.example/o', Buffer.alloc(2048))).rejects.toThrow(
      'Upload of 2.0 KB bundle failed: socket hang up',
    );
  });
});
