import { it, describe, expect, beforeAll, afterAll, inject } from 'vitest';
import { join, dirname } from 'path';
import { mkdtemp, rm, writeFile, readFile, cp } from 'fs/promises';
import { tmpdir } from 'os';
import { execa } from 'execa';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '__fixtures__');

async function setupFixture(fixtureName: string, registry: string, tag: string): Promise<string> {
  const fixturePath = await mkdtemp(join(tmpdir(), `workspace-tools-${fixtureName}-`));

  await cp(join(fixturesDir, fixtureName), fixturePath, { recursive: true });

  // Replace {{TAG}} in package.json with the snapshot tag
  const packageJsonPath = join(fixturePath, 'package.json');
  let packageJson = await readFile(packageJsonPath, 'utf-8');
  packageJson = packageJson.replace(/\{\{TAG\}\}/g, tag);
  await writeFile(packageJsonPath, packageJson);

  // Point to local registry
  await writeFile(join(fixturePath, '.npmrc'), `registry=${registry}\n`);

  await execa('npm', ['install'], {
    cwd: fixturePath,
    env: { ...process.env, npm_config_registry: registry },
  });

  return fixturePath;
}

async function runFixtureTest(fixturePath: string): Promise<{ toolNames: string[] }> {
  const { stdout } = await execa('node', ['test.mjs'], { cwd: fixturePath });
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1]);
}

describe('workspace tools — optional dependency gating', () => {
  let registry: string;
  let tag: string;
  const fixturePaths: string[] = [];

  beforeAll(() => {
    tag = inject('tag');
    registry = inject('registry');
  });

  afterAll(async () => {
    for (const fixturePath of fixturePaths) {
      try {
        await rm(fixturePath, { recursive: true, force: true });
      } catch {}
    }
  });

  it('should include ast_edit tool when @ast-grep/napi is installed', async () => {
    const fixturePath = await setupFixture('with-ast-grep', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    expect(result.toolNames).toContain('mastra_workspace_ast_edit');
  });

  it('should NOT include ast_edit tool when @ast-grep/napi is not installed', async () => {
    const fixturePath = await setupFixture('without-ast-grep', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    expect(result.toolNames).not.toContain('mastra_workspace_ast_edit');
  });

  it('should always include core filesystem tools regardless of @ast-grep/napi', async () => {
    const fixturePath = await setupFixture('without-ast-grep', registry, tag);
    fixturePaths.push(fixturePath);

    const result = await runFixtureTest(fixturePath);
    expect(result.toolNames).toContain('mastra_workspace_read_file');
    expect(result.toolNames).toContain('mastra_workspace_write_file');
    expect(result.toolNames).toContain('mastra_workspace_edit_file');
    expect(result.toolNames).toContain('mastra_workspace_list_files');
  });
});
