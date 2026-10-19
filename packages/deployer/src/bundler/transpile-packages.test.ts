import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bundler } from './index';

vi.mock('../services/deps', () => ({
  DepsService: class {
    __setLogger = vi.fn();
    install = vi.fn();
  },
}));

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');

class BuildBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  async build(serverFile: string, mastraEntryFile: string, projectRoot: string, outputDirectory: string) {
    await this.prepare(outputDirectory);
    return this._bundle(serverFile, mastraEntryFile, { projectRoot, outputDirectory });
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function readOutput(dir: string): Promise<string> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.mjs')).map(e => join(e.parentPath, e.name));
  return (await Promise.all(files.map(f => readFile(f, 'utf-8')))).join('\n');
}

/**
 * Issue #19380, end to end through the build: the option is read from the user's `new Mastra({ bundler })`
 * config in the entry file, exactly as `mastra build` does, instead of being handed to the analyzer directly.
 */
describe('bundler.transpilePackages in the Mastra config (issue #19380)', () => {
  it('transpiles a node_modules package listed in the entry file config during mastra build', async () => {
    await mkdir(tempRoot, { recursive: true });
    const projectRoot = await mkdtemp(join(tempRoot, 'mastra-transpile-config-'));
    tempDirs.push(projectRoot);

    const tsPackageDir = join(projectRoot, 'node_modules', 'ts-source-package');
    const mastraDir = join(projectRoot, 'src', 'mastra');
    const outputDirectory = join(projectRoot, '.mastra');
    await mkdir(join(tsPackageDir, 'src'), { recursive: true });
    await mkdir(mastraDir, { recursive: true });

    await writeFile(
      join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'transpile-config-app',
        version: '1.0.0',
        type: 'module',
        dependencies: { 'ts-source-package': '1.0.0' },
      }),
    );
    await writeFile(
      join(tsPackageDir, 'package.json'),
      JSON.stringify({ name: 'ts-source-package', version: '1.0.0', type: 'module', main: './src/index.ts' }),
    );
    await writeFile(
      join(tsPackageDir, 'src', 'index.ts'),
      `export interface Greeting { text: string }\nexport const greet = (name: string): Greeting => ({ text: \`hello \${name}\` });\n`,
    );

    const mastraEntryFile = join(mastraDir, 'index.ts');
    await writeFile(
      mastraEntryFile,
      [
        `import { Mastra } from '@mastra/core/mastra';`,
        `import { greet } from 'ts-source-package';`,
        `export const greeting = greet('mastra');`,
        `export const mastra = new Mastra({ bundler: { externals: ['@mastra/core'], transpilePackages: ['ts-source-package'] } });`,
      ].join('\n'),
    );
    const serverFile = join(projectRoot, 'server.mjs');
    await writeFile(serverFile, `export { greeting } from '#mastra';\n`);

    const originalCwd = process.cwd();
    process.chdir(projectRoot);
    try {
      await new BuildBundler('test-bundler').build(serverFile, mastraEntryFile, projectRoot, outputDirectory);
    } finally {
      process.chdir(originalCwd);
    }

    const output = await readOutput(join(outputDirectory, 'output'));
    expect(output, 'bundler.transpilePackages from the Mastra config was ignored by the build (#19380)').toContain(
      'hello ${name}',
    );
    expect(output).not.toContain('name: string');
    expect(output).not.toMatch(/from ['"]ts-source-package['"]/);
  }, 60_000);
});
