import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findMastraEntryFile } from './find-mastra-entry';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, statSync: vi.fn(actual.statSync) };
});

describe('findMastraEntryFile', () => {
  let directory: string;
  let tsEntry: string;
  let jsEntry: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mastra-entry-discovery-'));
    tsEntry = join(directory, 'index.ts');
    jsEntry = join(directory, 'index.js');
  });

  afterEach(() => {
    vi.mocked(statSync).mockReset();
    rmSync(directory, { recursive: true, force: true });
  });

  it('prefers TypeScript when both entries are regular files', () => {
    writeFileSync(tsEntry, '');
    writeFileSync(jsEntry, '');
    expect(findMastraEntryFile(directory)).toBe(tsEntry);
  });

  it('falls back to JavaScript when TypeScript is missing', () => {
    writeFileSync(jsEntry, '');
    expect(findMastraEntryFile(directory)).toBe(jsEntry);
  });

  it('skips a TypeScript directory before a JavaScript file', () => {
    mkdirSync(tsEntry);
    writeFileSync(jsEntry, '');
    expect(findMastraEntryFile(directory)).toBe(jsEntry);
  });

  it('returns undefined when both entries are directories', () => {
    mkdirSync(tsEntry);
    mkdirSync(jsEntry);
    expect(findMastraEntryFile(directory)).toBeUndefined();
  });

  it('returns undefined when neither entry exists', () => {
    expect(findMastraEntryFile(directory)).toBeUndefined();
  });

  it('returns the original symlink path when it resolves to a regular file', () => {
    writeFileSync(jsEntry, '');
    symlinkSync(jsEntry, tsEntry, 'file');
    expect(findMastraEntryFile(directory)).toBe(tsEntry);
  });

  it('skips a symlink to a directory', () => {
    const target = join(directory, 'target');
    mkdirSync(target);
    symlinkSync(target, tsEntry, 'junction');
    writeFileSync(jsEntry, '');
    expect(findMastraEntryFile(directory)).toBe(jsEntry);
  });

  it('skips a broken symlink', () => {
    symlinkSync(join(directory, 'missing'), tsEntry, 'file');
    writeFileSync(jsEntry, '');
    expect(findMastraEntryFile(directory)).toBe(jsEntry);
  });

  it('continues after a filesystem stat error', () => {
    writeFileSync(tsEntry, '');
    writeFileSync(jsEntry, '');
    vi.mocked(statSync).mockImplementationOnce(() => {
      throw new Error('stat failed');
    });
    expect(findMastraEntryFile(directory)).toBe(jsEntry);
  });
});
