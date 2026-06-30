import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileEnvService } from './env';

describe('FileEnvService.setEnvValue', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mastra-env-'));
    file = join(dir, '.env');
  });

  afterEach(async () => {
    // Cleanup is best-effort; Windows can transiently lock the temp dir.
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('preserves $ sequences in the value when replacing an existing key', async () => {
    await writeFile(file, 'PWD=old\n', 'utf8');
    const svc = new FileEnvService(file);

    // Values like DB URLs or passwords commonly contain $.
    const value = 'a$&b_$$_$1_end';
    await svc.setEnvValue('PWD', value);

    const content = await readFile(file, 'utf8');
    expect(content).toContain(`PWD=${value}`);
    expect(await svc.getEnvValue('PWD')).toBe(value);
  });

  it('writes value literally when the key is new', async () => {
    await writeFile(file, 'OTHER=1\n', 'utf8');
    const svc = new FileEnvService(file);

    const value = 'x$&y$$z';
    await svc.setEnvValue('NEWKEY', value);

    expect(await svc.getEnvValue('NEWKEY')).toBe(value);
  });
});
