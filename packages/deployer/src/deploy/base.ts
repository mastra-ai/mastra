import { MastraDeployer } from '@mastra/core/deployer';
import { emptyDir, ensureDir } from 'fs-extra';
import { join } from 'path';

import { writeFile } from 'fs/promises';

import { Deps } from '../build/deps.js';
import { FileService } from '../build/fs';

export abstract class Deployer extends MastraDeployer {
  deps: Deps = new Deps();
  override name: string = '';

  constructor(args: { name: string }) {
    super(args);

    this.deps.__setLogger(this.logger);
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.production', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {}

    return Promise.resolve([]);
  }

  async prepare(outputDirectory: string) {
    this.logger.info(`Preparing ${outputDirectory}...`);
    await ensureDir(outputDirectory);

    // Clean up the output directory first
    await emptyDir(outputDirectory);
  }

  async writePackageJson(outputDirectory: string, dependencies: Map<string, string>) {
    this.logger.debug(`Writing package.json`);
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

    await writeFile(pkgPath, JSON.stringify(dependencies, null, 2));
  }
}
