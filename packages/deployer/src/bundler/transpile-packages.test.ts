import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerOptions } from '../build/serverOptions';
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

  it('loads server options whose api route imports a listed package, as mastra dev does before watching', async () => {
    await mkdir(tempRoot, { recursive: true });
    const projectRoot = await mkdtemp(join(tempRoot, 'mastra-transpile-dev-'));
    tempDirs.push(projectRoot);

    const tsPackageDir = join(projectRoot, 'node_modules', 'ts-source-package');
    const mastraDir = join(projectRoot, 'src', 'mastra');
    await mkdir(join(tsPackageDir, 'src'), { recursive: true });
    await mkdir(mastraDir, { recursive: true });

    await writeFile(join(projectRoot, 'package.json'), JSON.stringify({ name: 'transpile-dev-app', type: 'module' }));
    await writeFile(
      join(tsPackageDir, 'package.json'),
      JSON.stringify({ name: 'ts-source-package', version: '1.0.0', type: 'module', main: './src/index.ts' }),
    );
    await writeFile(
      join(tsPackageDir, 'src', 'index.ts'),
      `export interface Greeting { text: string }\nexport const greet = (name: string): Greeting => ({ text: \`hello \${name}\` });\n`,
    );
    await writeFile(
      join(tsPackageDir, 'src', 'shout.ts'),
      `export const shout = (text: string): string => text.toUpperCase();\n`,
    );
    await writeFile(
      join(mastraDir, 'route.ts'),
      [
        `import { greet } from 'ts-source-package';`,
        `import { shout } from 'ts-source-package/src/shout.ts';`,
        `export const route = { path: '/transpiled', method: 'GET', handler: () => shout(greet('mastra').text) };`,
      ].join('\n'),
    );
    const mastraEntryFile = join(mastraDir, 'index.ts');
    await writeFile(
      mastraEntryFile,
      [
        `import { Mastra } from '@mastra/core/mastra';`,
        `import { route } from './route';`,
        `export const mastra = new Mastra({ server: { port: 4999, apiRoutes: [route] }, bundler: { transpilePackages: ['ts-source-package'] } });`,
      ].join('\n'),
    );

    const serverOptions = await getServerOptions(mastraEntryFile, join(projectRoot, '.mastra', 'output')).catch(
      (error: Error) => {
        throw new Error(`mastra dev could not read server options from a listed package (#19380): ${error.message}`);
      },
    );

    // Vitest transforms TypeScript on import, so also check what plain Node would load: the extracted config must
    // not import the raw package, which Node refuses to type-strip under node_modules.
    const extracted = await readFile(join(projectRoot, '.mastra', 'output', 'server-config.mjs'), 'utf-8');
    expect(
      extracted,
      'the extracted server config still imports raw TypeScript from node_modules (#19380)',
    ).not.toMatch(/from ['"](file:[^'"]*node_modules[^'"]*\.ts|ts-source-package[^'"]*)['"]/);

    const handler = serverOptions?.apiRoutes?.[0] as unknown as { handler: () => string };
    expect(handler.handler()).toBe('HELLO MASTRA');
  }, 60_000);
});
