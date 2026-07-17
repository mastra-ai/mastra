import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { assertDeployDir } from './validate-dir.js';

describe('assertDeployDir', () => {
  it('does nothing when no positional was passed', async () => {
    await expect(assertDeployDir(undefined, '/nonexistent')).resolves.toBeUndefined();
  });

  it('accepts an existing directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-deploy-dir-'));
    await expect(assertDeployDir(dir, dir)).resolves.toBeUndefined();
  });

  it('suggests --env when the positional looks like an environment name', async () => {
    await expect(assertDeployDir('staging', join(tmpdir(), 'does-not-exist-staging'))).rejects.toThrow(
      'Did you mean: mastra deploy --env staging',
    );
  });

  it('reports a plain missing directory for path-like arguments', async () => {
    const err = await assertDeployDir('./missing/path', join(tmpdir(), 'does-not-exist-path')).catch(e => e);
    expect(err.message).toContain('Directory not found: ./missing/path');
    expect(err.message).not.toContain('--env');
  });

  it('rejects a file passed as the deploy directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-deploy-file-'));
    const file = join(dir, 'staging');
    await writeFile(file, '');
    await expect(assertDeployDir('staging', file)).rejects.toThrow('Did you mean: mastra deploy --env staging');
  });
});
