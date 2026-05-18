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

    async function runStorageMigration() {
      const storage = mastra.getStorage();

      if (!storage) {
        return { skipped: true, message: 'Storage not configured' };
      }

      // Access the observability store directly from storage.stores
      const observabilityStore = storage.stores?.observability;

      if (!observabilityStore) {
        return { skipped: true, message: 'Observability storage not configured' };
      }

      // Check if the store has a migrateSpans method
      if (typeof observabilityStore.migrateSpans !== 'function') {
        return { skipped: true, message: 'Migration not supported for this storage backend' };
      }

      try {
        const result = await observabilityStore.migrateSpans();
        return {
          skipped: false,
          success: result.success,
          alreadyMigrated: result.alreadyMigrated,
          duplicatesRemoved: result.duplicatesRemoved,
          message: result.message,
        };
      } catch (error) {
        return {
          skipped: false,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error during storage migration',
        };
      }
    }

    async function runAuthSync() {
      // Check if studio auth is configured with RBAC
      const studioConfig = mastra.getStudio?.();
      const rbac = studioConfig?.rbac;

      if (!rbac) {
        return { skipped: true, message: 'Studio RBAC not configured' };
      }

      // Check if the RBAC provider has sync methods
      const hasSyncPermissions = typeof rbac.syncPermissionsToWorkOS === 'function';
      const hasSyncRoles = typeof rbac.syncRolesToWorkOS === 'function';

      if (!hasSyncPermissions && !hasSyncRoles) {
        return { skipped: true, message: 'RBAC provider does not support sync' };
      }

      const results = { permissions: null, roles: null };

      try {
        if (hasSyncPermissions) {
          results.permissions = await rbac.syncPermissionsToWorkOS();
        }
        if (hasSyncRoles) {
          results.roles = await rbac.syncRolesToWorkOS();
        }

        return {
          skipped: false,
          success: true,
          permissions: results.permissions,
          roles: results.roles,
        };
      } catch (error) {
        return {
          skipped: false,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error during auth sync',
        };
      }
    }

    async function runMigration() {
      const results = {
        storage: null,
        auth: null,
      };

      // Run storage migration
      results.storage = await runStorageMigration();

      // Run auth sync
      results.auth = await runAuthSync();

      // Determine overall success
      const storageOk = results.storage.skipped || results.storage.success;
      const authOk = results.auth.skipped || results.auth.success;
      const overallSuccess = storageOk && authOk;

      console.log(JSON.stringify({
        success: overallSuccess,
        storage: results.storage,
        auth: results.auth,
      }));

      process.exit(overallSuccess ? 0 : 1);
    }

    runMigration();
    `;
  }
}
