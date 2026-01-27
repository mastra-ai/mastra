import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DirectoryScanner } from './scanner';

describe('DirectoryScanner', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mastra-scanner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('scans directories at depth 1', async () => {
    await mkdir(join(testDir, 'project-a'));
    await mkdir(join(testDir, 'project-b'));

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 2 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project-a'));
    expect(dirs).toContain(join(testDir, 'project-b'));
  });

  it('scans nested directories up to maxDepth', async () => {
    await mkdir(join(testDir, 'level1', 'level2'), { recursive: true });

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 3 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'level1'));
    expect(dirs).toContain(join(testDir, 'level1', 'level2'));
  });

  it('respects maxDepth limit', async () => {
    // maxDepth=2 means scan at depth 0 and 1, so level1 and level2 are found
    // but level3 (depth 2) is not scanned
    await mkdir(join(testDir, 'level1', 'level2', 'level3'), { recursive: true });

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 2 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'level1'));
    expect(dirs).toContain(join(testDir, 'level1', 'level2'));
    expect(dirs).not.toContain(join(testDir, 'level1', 'level2', 'level3'));
  });

  it('respects maxDepth=1 to only scan immediate children', async () => {
    await mkdir(join(testDir, 'level1', 'level2'), { recursive: true });

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 1 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'level1'));
    expect(dirs).not.toContain(join(testDir, 'level1', 'level2'));
  });

  it('excludes node_modules by default', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, 'node_modules'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, 'node_modules'));
  });

  it('excludes .git by default', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, '.git'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, '.git'));
  });

  it('excludes hidden directories (starting with dot)', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, '.hidden'));
    await mkdir(join(testDir, '.config'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, '.hidden'));
    expect(dirs).not.toContain(join(testDir, '.config'));
  });

  it('excludes dist directory by default', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, 'dist'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, 'dist'));
  });

  it('excludes .next directory by default', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, '.next'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, '.next'));
  });

  it('excludes .mastra directory by default', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, '.mastra'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, '.mastra'));
  });

  it('uses custom exclude list', async () => {
    await mkdir(join(testDir, 'project'));
    await mkdir(join(testDir, 'custom-exclude'));

    const scanner = new DirectoryScanner({
      basePaths: [testDir],
      exclude: ['custom-exclude'],
    });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'project'));
    expect(dirs).not.toContain(join(testDir, 'custom-exclude'));
  });

  it('returns empty array for non-existent directory', async () => {
    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan('/non/existent/path');

    expect(dirs).toEqual([]);
  });

  it('returns empty array when maxDepth is 0', async () => {
    await mkdir(join(testDir, 'project'));

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 0 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toEqual([]);
  });

  it('handles deeply nested structures', async () => {
    await mkdir(join(testDir, 'a', 'b', 'c', 'd'), { recursive: true });

    const scanner = new DirectoryScanner({ basePaths: [testDir], maxDepth: 5 });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toContain(join(testDir, 'a'));
    expect(dirs).toContain(join(testDir, 'a', 'b'));
    expect(dirs).toContain(join(testDir, 'a', 'b', 'c'));
    expect(dirs).toContain(join(testDir, 'a', 'b', 'c', 'd'));
  });

  it('handles multiple directories at same level', async () => {
    await mkdir(join(testDir, 'project1'));
    await mkdir(join(testDir, 'project2'));
    await mkdir(join(testDir, 'project3'));

    const scanner = new DirectoryScanner({ basePaths: [testDir] });
    const dirs = await scanner.scan(testDir);

    expect(dirs).toHaveLength(3);
    expect(dirs).toContain(join(testDir, 'project1'));
    expect(dirs).toContain(join(testDir, 'project2'));
    expect(dirs).toContain(join(testDir, 'project3'));
  });
});
