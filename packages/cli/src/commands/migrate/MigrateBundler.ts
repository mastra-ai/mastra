import { FileService } from '@mastra/deployer/build';

import { BuildBundler } from '../build/BuildBundler.js';
import { shouldSkipDotenvLoading } from '../utils.js';

export class MigrateBundler extends BuildBundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super({ studio: false });
    this.customEnvFile = customEnvFile;
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

      try {
        // Access the observability store directly from storage.stores
        // This bypasses the init proxy that would re-throw MIGRATION_REQUIRED errors
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

        // Try to initialize the observability store - catch MIGRATION_REQUIRED errors
        // since that's exactly what we're here to fix
        try {
          await observabilityStore.init();
        } catch (initError) {
          // Check if this is a MIGRATION_REQUIRED error (which is expected)
          const errorMessage = initError instanceof Error ? initError.message : String(initError);
          const errorId = initError?.id || '';

          // Check for various forms of the migration required indicator
          const isMigrationRequired =
            errorId.includes('MIGRATION_REQUIRED') ||
            errorMessage.includes('MIGRATION_REQUIRED') ||
            errorMessage.includes('MIGRATION REQUIRED');

          if (!isMigrationRequired) {
            // Re-throw non-migration errors
            throw initError;
          }
          // MIGRATION_REQUIRED is expected - continue with migration
        }

        // Run the migration
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
