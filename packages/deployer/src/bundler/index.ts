import { MastraBundler } from '@mastra/core/bundler';
import virtual from '@rollup/plugin-virtual';
import { ensureDir } from 'fs-extra';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InputOptions, OutputOptions } from 'rollup';

import fsExtra from 'fs-extra/esm';

import { analyzeBundle } from '../build/analyze';
import { createBundler as createBundlerUtil, getInputOptions } from '../build/bundler';
import { Deps } from '../build/deps';
import { FileService } from '../build/fs';

export abstract class Bundler extends MastraBundler {
  protected analyzeOutputDir = '.build';
  protected outputDir = 'output';

  constructor(name: string) {
    super({ name, component: 'BUNDLER' });
  }

  protected abstract getEntry(): string;

  async prepare(outputDirectory: string): Promise<void> {
    await ensureDir(join(outputDirectory, this.analyzeOutputDir));
    await ensureDir(join(outputDirectory, this.outputDir));

    // Clean up the output directory first
    await fsExtra.emptyDir(outputDirectory);
  }

  async writePackageJson(outputDirectory: string, dependencies: Map<string, string>) {
    this.logger.debug(`Writing project's package.json`);
    await ensureDir(outputDirectory);
    const pkgPath = join(outputDirectory, 'package.json');

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
          dependencies: Object.fromEntries(dependencies),
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

  async bundle(mastraDir: string, outputDirectory: string): Promise<void> {
    this.logger.info('Start bundling Mastra');
    const fileService = new FileService();
    const mastraEntryFile = fileService.getFirstExistingFile([
      join(mastraDir, 'src/mastra/index.ts'),
      join(mastraDir, 'src/mastra/index.js'),
    ]);

    const inputFileOrVirtual = this.getEntry();
    const isVirtual = inputFileOrVirtual.includes('\n') || existsSync(inputFileOrVirtual);

    const analyzedBundleInfo = await analyzeBundle(
      inputFileOrVirtual,
      mastraEntryFile,
      join(outputDirectory, this.analyzeOutputDir),
      'node',
      this.logger,
    );

    this.writePackageJson(
      join(outputDirectory, this.outputDir),
      Array.from(analyzedBundleInfo.externalDependencies).reduce((acc, dep) => {
        acc.set(dep, 'latest');
        return acc;
      }, new Map<string, string>()),
    );

    const inputOptions: InputOptions = await getInputOptions(mastraEntryFile, analyzedBundleInfo, 'node');

    if (isVirtual) {
      inputOptions.input = { index: '#entry' };

      if (Array.isArray(inputOptions.plugins)) {
        inputOptions.plugins.unshift(virtual({ '#entry': this.getEntry() }));
      } else {
        inputOptions.plugins = [virtual({ '#entry': this.getEntry() })];
      }
    } else {
      inputOptions.input = { index: inputFileOrVirtual };
    }

    const bundler = await this.createBundler(inputOptions, { dir: join(outputDirectory, this.outputDir) });

    await bundler.write();
    this.logger.info('Bundling Mastra done');

    this.logger.info('Installing dependencies');
    await this.installDependencies(outputDirectory);
    this.logger.info('Done installing dependencies');
  }
}
