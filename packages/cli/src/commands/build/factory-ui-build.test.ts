import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveFactoryUIDevDist } from './factory-ui-build';

describe('resolveFactoryUIDevDist', () => {
  let tmpDir: string;
  let publicDir: string;
  let factoryUISource: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'factory-ui-dev-dist-test-'));
    publicDir = join(tmpDir, 'project', 'src', 'mastra', 'public');
    factoryUISource = join(tmpDir, 'cli-dist-factory');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('falls back to the CLI-bundled SPA when no local UI build exists', async () => {
    await mkdir(factoryUISource, { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>bundled</html>');

    expect(resolveFactoryUIDevDist(publicDir, factoryUISource)).toBe(factoryUISource);
  });

  it('prefers a locally built UI at public/factory by returning undefined', async () => {
    await mkdir(factoryUISource, { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>bundled</html>');
    await mkdir(join(publicDir, 'factory'), { recursive: true });
    await writeFile(join(publicDir, 'factory', 'index.html'), '<html>local</html>');

    expect(resolveFactoryUIDevDist(publicDir, factoryUISource)).toBeUndefined();
  });

  it('returns undefined when no prebuilt UI exists anywhere', () => {
    expect(resolveFactoryUIDevDist(publicDir, factoryUISource)).toBeUndefined();
  });
});
