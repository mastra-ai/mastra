import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileService } from './service.file';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('FileService.getFirstExistingFile', () => {
  let directory: string;
  let first: string;
  let second: string;
  const service = new FileService();

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mastra-file-discovery-'));
    temporaryDirectories.push(directory);
    first = join(directory, 'index.ts');
    second = join(directory, 'index.js');
  });

  it('skips a directory before a valid file', () => {
    mkdirSync(first);
    writeFileSync(second, '');
    expect(service.getFirstExistingFile([first, second])).toBe(second);
  });

  it('preserves candidate order for regular files', () => {
    writeFileSync(first, '');
    writeFileSync(second, '');
    expect(service.getFirstExistingFile([second, first])).toBe(second);
  });

  it('skips a missing candidate before a valid file', () => {
    writeFileSync(second, '');
    expect(service.getFirstExistingFile([first, second])).toBe(second);
  });

  it.each(['directories', 'missing', 'empty'])('preserves the exact error for %s candidates', kind => {
    if (kind === 'directories') {
      mkdirSync(first);
      mkdirSync(second);
    }
    const candidates = kind === 'empty' ? [] : [first, second];
    expect(() => service.getFirstExistingFile(candidates)).toThrow(
      new Error('Missing required file, checked the following paths: ' + candidates.join(', ')),
    );
  });

  it('returns the original symlink path when it resolves to a regular file', () => {
    writeFileSync(second, '');
    symlinkSync(second, first, 'file');
    expect(service.getFirstExistingFile([first, second])).toBe(first);
  });

  it('skips a symlink to a directory', () => {
    const target = join(directory, 'target');
    mkdirSync(target);
    symlinkSync(target, first, 'junction');
    writeFileSync(second, '');
    expect(service.getFirstExistingFile([first, second])).toBe(second);
  });

  it('skips a broken symlink', () => {
    symlinkSync(join(directory, 'missing'), first, 'file');
    writeFileSync(second, '');
    expect(service.getFirstExistingFile([first, second])).toBe(second);
  });

  it('continues after a filesystem stat error', () => {
    writeFileSync(first, '');
    writeFileSync(second, '');
    vi.spyOn(fs, 'statSync').mockImplementationOnce(() => {
      throw new Error('stat failed');
    });
    expect(service.getFirstExistingFile([first, second])).toBe(second);
  });
});

describe('FileService.replaceValuesInFile', () => {
  it.each(['$&', '$$', '$`', "$'"])('writes %s replacement tokens literally', replacement => {
    const directory = mkdtempSync(join(tmpdir(), 'mastra-file-service-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'template.txt');
    writeFileSync(filePath, 'before-TOKEN-after');

    new FileService().replaceValuesInFile({
      filePath,
      replacements: [{ search: 'TOKEN', replace: `${replacement}-literal` }],
    });

    expect(readFileSync(filePath, 'utf8')).toBe(`before-${replacement}-literal-after`);
  });
});
