import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm, symlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyDirectory } from './utils';

describe('copyDirectory', () => {
  let sourceDir: string;
  let destDir: string;

  beforeEach(async () => {
    const baseDir = join(tmpdir(), `mastra-copy-test-${Date.now()}`);
    sourceDir = join(baseDir, 'source');
    destDir = join(baseDir, 'dest');
    await mkdir(sourceDir, { recursive: true });
  });

  afterEach(async () => {
    const baseDir = join(sourceDir, '..');
    await rm(baseDir, { recursive: true, force: true });
  });

  it('copies files from source to destination', async () => {
    await writeFile(join(sourceDir, 'file.txt'), 'hello world');

    await copyDirectory(sourceDir, destDir);

    const content = await readFile(join(destDir, 'file.txt'), 'utf-8');
    expect(content).toBe('hello world');
  });

  it('copies nested directories', async () => {
    await mkdir(join(sourceDir, 'nested', 'deep'), { recursive: true });
    await writeFile(join(sourceDir, 'nested', 'deep', 'file.txt'), 'nested content');

    await copyDirectory(sourceDir, destDir);

    const content = await readFile(join(destDir, 'nested', 'deep', 'file.txt'), 'utf-8');
    expect(content).toBe('nested content');
  });

  it('creates destination directory if it does not exist', async () => {
    await writeFile(join(sourceDir, 'file.txt'), 'test');

    await copyDirectory(sourceDir, destDir);

    const stats = await stat(destDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('excludes specified directories', async () => {
    await mkdir(join(sourceDir, 'include'));
    await mkdir(join(sourceDir, 'exclude'));
    await writeFile(join(sourceDir, 'include', 'file.txt'), 'included');
    await writeFile(join(sourceDir, 'exclude', 'file.txt'), 'excluded');

    await copyDirectory(sourceDir, destDir, { exclude: ['exclude'] });

    const entries = await readdir(destDir);
    expect(entries).toContain('include');
    expect(entries).not.toContain('exclude');
  });

  it('excludes specified files', async () => {
    await writeFile(join(sourceDir, 'keep.txt'), 'keep');
    await writeFile(join(sourceDir, 'remove.txt'), 'remove');

    await copyDirectory(sourceDir, destDir, { exclude: ['remove.txt'] });

    const entries = await readdir(destDir);
    expect(entries).toContain('keep.txt');
    expect(entries).not.toContain('remove.txt');
  });

  it('handles multiple exclude patterns', async () => {
    await mkdir(join(sourceDir, 'node_modules'));
    await mkdir(join(sourceDir, '.git'));
    await mkdir(join(sourceDir, 'src'));
    await writeFile(join(sourceDir, 'node_modules', 'dep.js'), 'dep');
    await writeFile(join(sourceDir, '.git', 'config'), 'config');
    await writeFile(join(sourceDir, 'src', 'index.ts'), 'code');

    await copyDirectory(sourceDir, destDir, { exclude: ['node_modules', '.git'] });

    const entries = await readdir(destDir);
    expect(entries).toContain('src');
    expect(entries).not.toContain('node_modules');
    expect(entries).not.toContain('.git');
  });

  it('copies symbolic links', async () => {
    await writeFile(join(sourceDir, 'original.txt'), 'original content');
    await symlink('original.txt', join(sourceDir, 'link.txt'));

    await copyDirectory(sourceDir, destDir);

    const linkStats = await stat(join(destDir, 'link.txt'));
    // The symlink should be copied, not the target file
    const entries = await readdir(destDir);
    expect(entries).toContain('original.txt');
    expect(entries).toContain('link.txt');
  });

  it('copies empty directories', async () => {
    await mkdir(join(sourceDir, 'empty'));

    await copyDirectory(sourceDir, destDir);

    const stats = await stat(join(destDir, 'empty'));
    expect(stats.isDirectory()).toBe(true);
    const entries = await readdir(join(destDir, 'empty'));
    expect(entries).toHaveLength(0);
  });

  it('preserves file contents exactly', async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    await writeFile(join(sourceDir, 'binary.bin'), binaryContent);

    await copyDirectory(sourceDir, destDir);

    const copiedContent = await readFile(join(destDir, 'binary.bin'));
    expect(copiedContent.equals(binaryContent)).toBe(true);
  });

  it('handles deeply nested structures', async () => {
    const deepPath = join(sourceDir, 'a', 'b', 'c', 'd', 'e');
    await mkdir(deepPath, { recursive: true });
    await writeFile(join(deepPath, 'deep.txt'), 'deep content');

    await copyDirectory(sourceDir, destDir);

    const content = await readFile(join(destDir, 'a', 'b', 'c', 'd', 'e', 'deep.txt'), 'utf-8');
    expect(content).toBe('deep content');
  });

  it('excludes nested directories matching exclude pattern', async () => {
    await mkdir(join(sourceDir, 'project', 'node_modules'), { recursive: true });
    await mkdir(join(sourceDir, 'project', 'src'), { recursive: true });
    await writeFile(join(sourceDir, 'project', 'node_modules', 'dep.js'), 'dep');
    await writeFile(join(sourceDir, 'project', 'src', 'index.ts'), 'code');

    await copyDirectory(sourceDir, destDir, { exclude: ['node_modules'] });

    const projectEntries = await readdir(join(destDir, 'project'));
    expect(projectEntries).toContain('src');
    expect(projectEntries).not.toContain('node_modules');
  });

  it('copies multiple files in same directory', async () => {
    await writeFile(join(sourceDir, 'file1.txt'), 'content1');
    await writeFile(join(sourceDir, 'file2.txt'), 'content2');
    await writeFile(join(sourceDir, 'file3.txt'), 'content3');

    await copyDirectory(sourceDir, destDir);

    const entries = await readdir(destDir);
    expect(entries).toHaveLength(3);
    expect(entries).toContain('file1.txt');
    expect(entries).toContain('file2.txt');
    expect(entries).toContain('file3.txt');
  });

  it('works with empty exclude list', async () => {
    await writeFile(join(sourceDir, 'file.txt'), 'test');

    await copyDirectory(sourceDir, destDir, { exclude: [] });

    const content = await readFile(join(destDir, 'file.txt'), 'utf-8');
    expect(content).toBe('test');
  });

  it('works with no options', async () => {
    await writeFile(join(sourceDir, 'file.txt'), 'test');

    await copyDirectory(sourceDir, destDir);

    const content = await readFile(join(destDir, 'file.txt'), 'utf-8');
    expect(content).toBe('test');
  });
});
