import { FileService } from '@mastra/deployer/build';

import { BuildBundler } from '../build/BuildBundler.js';
import { shouldSkipDotenvLoading } from '../utils.js';

export class MigrateBundler extends BuildBundler {
  private customEnvFile?: string;
  private skipInstall: boolean;

  constructor(customEnvFile?: string, skipInstall = false) {
    super({ studio: false });
    this.customEnvFile = customEnvFile;
    this.skipInstall = skipInstall;
  }

  protected override async installDependencies(outputDirectory: string, rootDir?: string): Promise<void> {
    if (
      this.skipInstall ||
      process.env['YARN_ENABLE_IMMUTABLE_INSTALLS'] === 'true' ||
      process.env['npm_command'] === 'ci' ||
      process.env['npm_config_ci'] === 'true'
    ) {
      this.logger?.info('Skipping dependency installation (immutable lockfile mode or --skip-install flag)');
      return;
    }
    return super.installDependencies(outputDirectory, rootDir);
  }

  override getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    const possibleFiles = ['.env.development', '.env.local', '.env'];
    if (this.customEnvFile) {
      possibleFiles.unshift(this.customEnvFile);
    }

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected override getEntry(): string {
    return `
    import { mastra } from '#mastra';

    async function runMigration() {
      const storage = mastra.getStorage();

      if (!storage) {
        console.log(JSON.stringify({
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: 'Storage not configured. Please configure storage in your Mastra instance.',
        }));
        process.exit(1);
      }

      // Access the observability store directly from storage.stores
      const observabilityStore = storage.stores?.observability;

      if (!observabilityStore) {
        console.log(JSON.stringify({
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: 'Observability storage not configured. Migration not required.',
        }));
        process.exit(0);
      }

      // Check if the store has a migrateSpans method
      if (typeof observabilityStore.migrateSpans !== 'function') {
        console.log(JSON.stringify({
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: 'Migration not supported for this storage backend.',
        }));
        process.exit(1);
      }

      try {
        // Run the migration - migrateSpans handles everything internally
        const result = await observabilityStore.migrateSpans();

        console.log(JSON.stringify({
          success: result.success,
          alreadyMigrated: result.alreadyMigrated,
          duplicatesRemoved: result.duplicatesRemoved,
          message: result.message,
        }));

        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.log(JSON.stringify({
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: error instanceof Error ? error.message : 'Unknown error during migration',
        }));
        process.exit(1);
      }
    }

    runMigration();
    `;
  }
}
