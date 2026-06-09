import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

// Test the path resolution and file I/O logic that ACPClient uses.
// ACPClient is internal so we replicate its scoping logic here.

function resolveWithinWorkspace(workspaceRoot: string, filePath: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);

  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    throw new Error(`ACP file access denied: path escapes workspace root (${workspaceRoot})`);
  }

  return resolved;
}

async function readTextFile(workspaceRoot: string, filePath: string, line?: number, limit?: number) {
  const resolved = resolveWithinWorkspace(workspaceRoot, filePath);
  const content = await fs.readFile(resolved, 'utf-8');

  if (line != null || limit != null) {
    const lines = content.split('\n');
    const start = (line ?? 1) - 1;
    const end = limit != null ? start + limit : lines.length;
    return { content: lines.slice(start, end).join('\n') };
  }

  return { content };
}

async function writeTextFile(workspaceRoot: string, filePath: string, content: string) {
  const resolved = resolveWithinWorkspace(workspaceRoot, filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');
}

describe('workspace path scoping', () => {
  it('allows paths within the workspace root', () => {
    expect(resolveWithinWorkspace('/workspace', '/workspace/file.txt')).toBe('/workspace/file.txt');
    expect(resolveWithinWorkspace('/workspace', '/workspace/sub/file.txt')).toBe('/workspace/sub/file.txt');
  });

  it('resolves relative paths against workspace root', () => {
    expect(resolveWithinWorkspace('/workspace', 'file.txt')).toBe('/workspace/file.txt');
    expect(resolveWithinWorkspace('/workspace', 'sub/file.txt')).toBe('/workspace/sub/file.txt');
  });

  it('allows access to the workspace root itself', () => {
    expect(resolveWithinWorkspace('/workspace', '/workspace')).toBe('/workspace');
  });

  it('rejects paths that escape the workspace root', () => {
    expect(() => resolveWithinWorkspace('/workspace', '/etc/passwd')).toThrow('path escapes workspace root');
    expect(() => resolveWithinWorkspace('/workspace', '../secret')).toThrow('path escapes workspace root');
    expect(() => resolveWithinWorkspace('/workspace', '/workspace-other/file')).toThrow('path escapes workspace root');
  });
});

describe('file read/write integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acp-fs-'));
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads a full file', async () => {
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'line1\nline2\nline3', 'utf-8');
    const result = await readTextFile(tmpDir, 'hello.txt');
    expect(result.content).toBe('line1\nline2\nline3');
  });

  it('reads a file with line/limit parameters', async () => {
    await fs.writeFile(path.join(tmpDir, 'lines.txt'), 'a\nb\nc\nd\ne', 'utf-8');
    const result = await readTextFile(tmpDir, 'lines.txt', 2, 2);
    expect(result.content).toBe('b\nc');
  });

  it('writes a file including nested directories', async () => {
    await writeTextFile(tmpDir, 'sub/new-file.txt', 'new content');
    const content = await fs.readFile(path.join(tmpDir, 'sub', 'new-file.txt'), 'utf-8');
    expect(content).toBe('new content');
  });

  it('rejects reading files outside workspace', async () => {
    await expect(readTextFile(tmpDir, '../../etc/passwd')).rejects.toThrow('path escapes workspace root');
  });

  it('rejects writing files outside workspace', async () => {
    await expect(writeTextFile(tmpDir, '../../tmp/evil.txt', 'pwned')).rejects.toThrow('path escapes workspace root');
  });
});
