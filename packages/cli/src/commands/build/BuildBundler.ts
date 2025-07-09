import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';

export class BuildBundler extends Bundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super('Build');
    this.customEnvFile = customEnvFile;
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.production', '.env.local', '.env'];
    if (this.customEnvFile) {
      possibleFiles.unshift(this.customEnvFile);
    }

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch (err) {
      // ignore
    }

    return Promise.resolve([]);
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, outputDirectory, toolsPaths);
  }

  protected getEntry(): string {
    return `
    // @ts-ignore
    import { mastra } from '#mastra';
    import { createNodeServer } from '#server';
    // @ts-ignore
    await createNodeServer(mastra);

    if (mastra.getStorage()) {
      // start storage init in the background
      mastra.getStorage().init();
    }
    `;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }
}
