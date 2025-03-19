import { existsSync } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MastraBundler } from '@mastra/core/bundler';
import virtual from '@rollup/plugin-virtual';
import { copy, ensureDir, readJSON, emptyDir } from 'fs-extra/esm';
import resolveFrom from 'resolve-from';
import type { InputOptions, OutputOptions } from 'rollup';
import { rollup } from 'rollup';

import { analyzeBundle } from '../build/analyze';
import { createBundler as createBundlerUtil, getInputOptions } from '../build/bundler';
import { Deps } from '../build/deps';
import { writeTelemetryConfig } from '../build/telemetry';

export abstract class Bundler extends MastraBundler {
  protected analyzeOutputDir = '.build';
  protected outputDir = 'output';

  constructor(name: string, component: 'BUNDLER' | 'DEPLOYER' = 'BUNDLER') {
    super({ name, component });
  }

  async prepare(outputDirectory: string): Promise<void> {
    // Clean up the output directory first
    await emptyDir(outputDirectory);

    await ensureDir(join(outputDirectory, this.analyzeOutputDir));
    await ensureDir(join(outputDirectory, this.outputDir));
  }

  async writeInstrumentationFile(outputDirectory: string) {
    const instrumentationFile = join(outputDirectory, 'instrumentation.mjs');
    const __dirname = dirname(fileURLToPath(import.meta.url));

    await copy(join(__dirname, 'templates', 'instrumentation-template.js'), instrumentationFile);
  }

  async writePackageJson(outputDirectory: string, dependencies: Map<string, string>) {
    this.logger.debug(`Writing project's package.json`);
    await ensureDir(outputDirectory);
    const pkgPath = join(outputDirectory, 'package.json');

    const dependenciesMap = new Map();
    for (const [key, value] of dependencies.entries()) {
      if (key.startsWith('@')) {
        const pkgChunks = key.split('/');
        dependenciesMap.set(`${pkgChunks[0]}/${pkgChunks[1]}`, value);
        continue;
      }
      dependenciesMap.set(key, value);
    }

    dependenciesMap.set('@opentelemetry/instrumentation', 'latest');

    await writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          description: '',
          type: 'module',
          main: 'index.mjs',
          scripts: {
            start: 'node ./index.mjs',
          },
          author: 'Mastra',
          license: 'ISC',
          dependencies: Object.fromEntries(dependenciesMap.entries()),
        },
        null,
        2,
      ),
    );
  }

  protected createBundler(inputOptions: InputOptions, outputOptions: Partial<OutputOptions> & { dir: string }) {
    return createBundlerUtil(inputOptions, outputOptions);
  }

  protected async analyze(entry: string, mastraFile: string, outputDirectory: string) {
    return await analyzeBundle(entry, mastraFile, join(outputDirectory, this.analyzeOutputDir), 'node', this.logger);
  }

  protected async installDependencies(outputDirectory: string, rootDir = process.cwd()) {
    const deps = new Deps(rootDir);
    deps.__setLogger(this.logger);

    await deps.install({ dir: join(outputDirectory, this.outputDir) });
  }

  protected async copyPublic(mastraDir: string, outputDirectory: string) {
    const publicDir = join(mastraDir, 'public');

    try {
      await stat(publicDir);
    } catch {
      return;
    }

    await copy(publicDir, join(outputDirectory, this.outputDir));
  }

  protected async _bundle(
    entry: string,
    entryFile: string,
    outputDirectory: string,
    options?: { port?: number },
  ): Promise<void> {
    const env = await this.loadEnvVars();
    const virtualEntry = entry
      .replace('process.env.PORT', options?.port?.toString() || 'process.env.PORT || "4111"')
      .replace('#mastra', entryFile);

    const bundle = await rollup({
      input: 'virtual-entry',
      plugins: [
        {
          name: 'virtual',
          resolveId(id) {
            if (id === 'virtual-entry') {
              return id;
            }
            return null;
          },
          load(id) {
            if (id === 'virtual-entry') {
              return virtualEntry;
            }
            return null;
          },
        },
        // ... rest of plugins ...
      ],
    });

    await bundle.write({
      dir: join(outputDirectory, this.outputDir),
      format: 'es',
      sourcemap: true,
    });

    await bundle.close();
  }
}
