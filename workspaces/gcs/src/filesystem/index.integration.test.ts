/**
 * GCS Filesystem Integration Tests
 *
 * These tests require real GCS credentials and run against
 * actual Google Cloud Storage.
 *
 * Required environment variables:
 * - GCS_SERVICE_ACCOUNT_KEY: JSON service account key (single-quoted in env file)
 * - TEST_GCS_BUCKET: Bucket name
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { GCSFilesystem } from './index';

/**
 * Check if we have GCS credentials.
 */
const hasGCSCredentials = !!(process.env.GCS_SERVICE_ACCOUNT_KEY && process.env.TEST_GCS_BUCKET);

describe.skipIf(!hasGCSCredentials)('GCSFilesystem Integration', () => {
  const testBucket = process.env.TEST_GCS_BUCKET!;
  let credentials: object;
  let fs: GCSFilesystem;
  let testPrefix: string;

  beforeEach(() => {
    credentials = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!);
    testPrefix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    fs = new GCSFilesystem({
      bucket: testBucket,
      credentials,
      prefix: testPrefix,
    });
  });

  afterEach(async () => {
    // Cleanup: delete all files with our test prefix
    try {
      const files = await fs.readdir('/');
      for (const file of files) {
        if (file.type === 'file') {
          await fs.deleteFile(`/${file.name}`, { force: true });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('can write and read files', async () => {
    await fs.init();

    await fs.writeFile('/test.txt', 'Hello GCS!');
    const content = await fs.readFile('/test.txt', { encoding: 'utf-8' });

    expect(content).toBe('Hello GCS!');
  });

  it('can check file existence', async () => {
    await fs.init();

    expect(await fs.exists('/nonexistent.txt')).toBe(false);

    await fs.writeFile('/exists.txt', 'I exist');
    expect(await fs.exists('/exists.txt')).toBe(true);
  });

  it('can delete files', async () => {
    await fs.init();

    await fs.writeFile('/to-delete.txt', 'Delete me');
    expect(await fs.exists('/to-delete.txt')).toBe(true);

    await fs.deleteFile('/to-delete.txt');
    expect(await fs.exists('/to-delete.txt')).toBe(false);
  });

  it('can list files', async () => {
    await fs.init();

    await fs.writeFile('/file1.txt', 'Content 1');
    await fs.writeFile('/file2.txt', 'Content 2');

    const files = await fs.readdir('/');
    const names = files.map(f => f.name);

    expect(names).toContain('file1.txt');
    expect(names).toContain('file2.txt');
  });

  it('can copy files', async () => {
    await fs.init();

    await fs.writeFile('/original.txt', 'Original content');
    await fs.copyFile('/original.txt', '/copied.txt');

    const content = await fs.readFile('/copied.txt', { encoding: 'utf-8' });
    expect(content).toBe('Original content');
  });

  it('can move files', async () => {
    await fs.init();

    await fs.writeFile('/source.txt', 'Move me');
    await fs.moveFile('/source.txt', '/destination.txt');

    expect(await fs.exists('/source.txt')).toBe(false);
    expect(await fs.exists('/destination.txt')).toBe(true);

    const content = await fs.readFile('/destination.txt', { encoding: 'utf-8' });
    expect(content).toBe('Move me');
  });

  it('can get file stats', async () => {
    await fs.init();

    await fs.writeFile('/stats.txt', 'Some content');
    const stat = await fs.stat('/stats.txt');

    expect(stat.name).toBe('stats.txt');
    expect(stat.type).toBe('file');
    expect(stat.size).toBeGreaterThan(0);
  });
});
