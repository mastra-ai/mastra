import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PinoLogger } from '@mastra/loggers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFactoryUI, copyFactorySkills, resolveFactoryUIDevDist } from './factory-ui-build';

const logger = new PinoLogger({ name: 'test', level: 'silent' });

describe('buildFactoryUI', () => {
  let tmpDir: string;
  let mastraDir: string;
  let factoryUISource: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'factory-ui-build-test-'));
    mastraDir = join(tmpDir, 'project', 'src', 'mastra');
    factoryUISource = join(tmpDir, 'prebuilt-factory');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('copies the prebuilt Factory UI into the Mastra public directory', async () => {
    await mkdir(join(factoryUISource, 'assets'), { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>factory</html>');
    await writeFile(join(factoryUISource, 'assets', 'app.js'), 'console.log("factory")');

    await buildFactoryUI(mastraDir, logger, factoryUISource);

    await expect(readFile(join(mastraDir, 'public', 'factory', 'index.html'), 'utf8')).resolves.toBe(
      '<html>factory</html>',
    );
    await expect(readFile(join(mastraDir, 'public', 'factory', 'assets', 'app.js'), 'utf8')).resolves.toBe(
      'console.log("factory")',
    );
  });

  it('overwrites stale Factory UI assets', async () => {
    await mkdir(factoryUISource, { recursive: true });
    await writeFile(join(factoryUISource, 'index.html'), '<html>current</html>');

    const outputDir = join(mastraDir, 'public', 'factory');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'index.html'), '<html>stale</html>');

    await buildFactoryUI(mastraDir, logger, factoryUISource);

    await expect(readFile(join(outputDir, 'index.html'), 'utf8')).resolves.toBe('<html>current</html>');
  });

  it('throws when the prebuilt Factory UI is missing', async () => {
    await expect(buildFactoryUI(mastraDir, logger, factoryUISource)).rejects.toThrow(/Prebuilt Factory UI not found/);
  });
});

describe('copyFactorySkills', () => {
  let tmpDir: string;
  let mastraDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'factory-skills-build-test-'));
    mastraDir = join(tmpDir, 'project', 'src', 'mastra');
    outputDir = join(tmpDir, 'project', '.mastra', 'output');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('copies src/mastra/factory-skills into the build output in place of the public folder copy', async () => {
    await mkdir(join(mastraDir, 'factory-skills', 'release-notes'), { recursive: true });
    await writeFile(join(mastraDir, 'factory-skills', 'release-notes', 'SKILL.md'), 'current');
    // What copyPublic() left from the older src/mastra/public/factory-skills.
    await mkdir(join(outputDir, 'factory-skills', 'release-notes'), { recursive: true });
    await writeFile(join(outputDir, 'factory-skills', 'release-notes', 'SKILL.md'), 'public');
    await mkdir(join(outputDir, 'factory-skills', 'old-skill'), { recursive: true });
    await writeFile(join(outputDir, 'factory-skills', 'old-skill', 'SKILL.md'), 'old');

    await copyFactorySkills(mastraDir, outputDir, logger);

    await expect(readFile(join(outputDir, 'factory-skills', 'release-notes', 'SKILL.md'), 'utf8')).resolves.toBe(
      'current',
    );
    // Factory resolves only src/mastra/factory-skills when both exist, so the build must not keep public-only skills.
    await expect(readFile(join(outputDir, 'factory-skills', 'old-skill', 'SKILL.md'), 'utf8')).rejects.toThrow(
      'ENOENT',
    );
  });

  it('does nothing when the project has no factory-skills folder', async () => {
    await copyFactorySkills(mastraDir, outputDir, logger);

    await expect(readFile(join(outputDir, 'factory-skills', 'x', 'SKILL.md'), 'utf8')).rejects.toThrow('ENOENT');
  });
});

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
