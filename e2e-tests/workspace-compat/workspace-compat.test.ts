import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join, dirname } from 'path';
import { mkdtemp, rm, writeFile, readFile, cp } from 'fs/promises';
import { tmpdir } from 'os';
import { execa } from 'execa';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '__fixtures__/playground-ui');

async function setupFixture(fixtureName: string, registry: string, tag: string): Promise<string> {
  const fixturePath = await mkdtemp(join(tmpdir(), `workspace-compat-${fixtureName}-`));

  // Copy fixture to temp directory
  await cp(join(fixturesDir, fixtureName), fixturePath, { recursive: true });

  // Read and update package.json with the actual tag
  const packageJsonPath = join(fixturePath, 'package.json');
  let packageJson = await readFile(packageJsonPath, 'utf-8');
  packageJson = packageJson.replace(/\{\{TAG\}\}/g, tag);
  await writeFile(packageJsonPath, packageJson);

  // Create .npmrc to use local registry
  await writeFile(join(fixturePath, '.npmrc'), `registry=${registry}\n`);

  // Install dependencies
  // Use --legacy-peer-deps because old-client fixture installs @mastra/client-js@1.0.1
  // which doesn't match playground-ui's peerDep of ^0.0.0-workspace-compat-e2e-xxx
  await execa('npm', ['install', '--legacy-peer-deps'], {
    cwd: fixturePath,
    env: { ...process.env, npm_config_registry: registry },
  });

  return fixturePath;
}

async function runFixtureTest(fixturePath: string): Promise<{ isSupported: boolean }> {
  const { stdout } = await execa('node', ['test.mjs'], {
    cwd: fixturePath,
  });

  // Parse the JSON output (last line)
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
}

describe('workspace version compatibility', () => {
  let registry: string;
  let tag: string;
  const fixturePaths: string[] = [];

  beforeAll(() => {
    tag = inject('tag');
    registry = inject('registry');
    console.log('registry', registry);
    console.log('tag', tag);
  });

  afterAll(async () => {
    for (const fixturePath of fixturePaths) {
      try {
        await rm(fixturePath, { recursive: true, force: true });
      } catch {}
    }
  });

  it('should return true when both core and client support workspaces-v1', async () => {
    const fixturePath = await setupFixture('matching-versions', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    console.log('matching-versions', result);
    expect(result.isSupported).toBe(true);
  });

  it('should return false when using old core without workspaces-v1 feature', async () => {
    const fixturePath = await setupFixture('old-core', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    console.log('old-core', result);
    expect(result.isSupported).toBe(false);
  });

  it('should return false when using old client without workspace methods', async () => {
    const fixturePath = await setupFixture('old-client', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    console.log('old-client', result);
    expect(result.isSupported).toBe(false);
  });
});
