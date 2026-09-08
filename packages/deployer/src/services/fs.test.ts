import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileService } from './fs';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('FileService.getExistingFiles', () => {
  it('returns every existing file in the supplied precedence order', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-files-'));
    directories.push(directory);
    const base = join(directory, '.env');
    const local = join(directory, '.env.local');
    const missing = join(directory, '.env.production');
    await Promise.all([writeFile(base, ''), writeFile(local, '')]);

    expect(new FileService().getExistingFiles([base, missing, local])).toEqual([base, local]);
  });
});
