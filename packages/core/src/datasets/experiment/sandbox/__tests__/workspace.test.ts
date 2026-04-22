import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { materializeWorkspace, destroyWorkspace } from '../workspace';

const createdDirs: string[] = [];

afterEach(async () => {
  for (const dir of createdDirs) {
    try {
      await destroyWorkspace(dir);
    } catch {
      /* ignore */
    }
  }
  createdDirs.length = 0;
});

describe('materializeWorkspace', () => {
  it('creates files on disk from directory snapshot', async () => {
    const path = await materializeWorkspace({
      type: 'directory',
      files: [
        { path: 'src/index.ts', content: 'export const x = 1;' },
        { path: 'package.json', content: '{"name":"test"}' },
      ],
    });
    createdDirs.push(path);

    expect(path.startsWith(tmpdir())).toBe(true);
    expect(readFileSync(join(path, 'src/index.ts'), 'utf-8')).toBe('export const x = 1;');
    expect(readFileSync(join(path, 'package.json'), 'utf-8')).toBe('{"name":"test"}');
  });
});

describe('destroyWorkspace', () => {
  it('refuses to destroy paths outside tmpdir', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await destroyWorkspace('/home/user/important');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Refusing to destroy'));
    warn.mockRestore();
  });
});
