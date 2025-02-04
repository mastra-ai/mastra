import { MastraBundler } from '@mastra/core/bundler';
import { FileService, getBundler } from '@mastra/deployer';
import virtual from '@rollup/plugin-virtual';
import * as fsExtra from 'fs-extra';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export class BuildBundler extends MastraBundler {
  constructor() {
    super({
      name: 'Build',
      component: 'BUNDLER',
    });
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.production', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch (err) {}

    return Promise.resolve([]);
  }

  async prepare(outputDirectory: string): Promise<void> {
    await fsExtra.ensureDir(outputDirectory);

    // Clean up the output directory first
    await fsExtra.emptyDir(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const playgroundServePath = join(outputDirectory, 'playground');
    await fsExtra.copy(join(dirname(__dirname), 'src/playground/dist'), playgroundServePath, {
      overwrite: true,
    });
  }

  async bundle(mastraDir: string, outputDirectory: string): Promise<void> {
    const bundler = await getBundler({
      input: '#entry',
      plugins: [virtual({ '#entry': this.getEntry() })],
    });

    await bundler.write({
      file: `${outputDirectory}/index.mjs`,
      format: 'es',
      inlineDynamicImports: true,
    });
  }

  private getEntry(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return readFileSync(join(__dirname, 'templates', 'dev.entry.js'), 'utf8');
  }
}
