import { readFileSync } from 'node:fs';

import type { Mastra } from '@mastra/core';
import { z } from 'zod';

import type { MastraPackage } from '../schemas/system';
import { systemPackagesResponseSchema, migrateSpansResponseSchema } from '../schemas/system';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

export const GET_SYSTEM_PACKAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/system/packages',
  responseType: 'json',
  responseSchema: systemPackagesResponseSchema,
  summary: 'Get installed Mastra packages',
  description: 'Returns a list of all installed Mastra packages and their versions from the project',
  tags: ['System'],
  handler: async () => {
    try {
      const packagesFilePath = process.env.MASTRA_PACKAGES_FILE;

      let packages: MastraPackage[] = [];

      if (packagesFilePath) {
        try {
          const fileContent = readFileSync(packagesFilePath, 'utf-8');
          packages = JSON.parse(fileContent);
        } catch {
          packages = [];
        }
      }

      return { packages };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});

/**
 * Helper function to get the storage from the Mastra instance.
 */
function getStorage(mastra: Mastra) {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new Error('Storage not configured. Please configure storage in your Mastra instance.');
  }
  return storage;
}

export const POST_MIGRATE_SPANS_ROUTE = createRoute({
  method: 'POST',
  path: '/api/system/migrate',
  responseType: 'json',
  responseSchema: migrateSpansResponseSchema,
  summary: 'Run spans migration',
  description:
    'Runs the spans table migration to deduplicate existing data and add unique constraint. This is required when duplicate spans are detected during startup.',
  tags: ['System'],
  handler: async ({ mastra }) => {
    try {
      const storage = getStorage(mastra);

      // Get the observability store from storage
      const observabilityStore = await storage.getStore('observability');
      if (!observabilityStore) {
        return {
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: 'Observability storage not configured. Migration not required.',
        };
      }

      // Check if the store has a migrateSpans method
      if (typeof (observabilityStore as any).migrateSpans !== 'function') {
        return {
          success: false,
          alreadyMigrated: false,
          duplicatesRemoved: 0,
          message: 'Migration not supported for this storage backend.',
        };
      }

      // Run the migration
      const result = await (observabilityStore as any).migrateSpans();

      return {
        success: result.success,
        alreadyMigrated: result.alreadyMigrated,
        duplicatesRemoved: result.duplicatesRemoved,
        message: result.message,
      };
    } catch (error) {
      return handleError(error, 'Error running spans migration');
    }
  },
});

export const GET_MIGRATION_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/system/migrate/status',
  responseType: 'json',
  responseSchema: z.object({
    needsMigration: z.boolean(),
    hasDuplicates: z.boolean(),
    duplicateCount: z.number(),
    constraintExists: z.boolean(),
    tableName: z.string(),
  }),
  summary: 'Get migration status',
  description: 'Returns the current migration status for the spans table.',
  tags: ['System'],
  handler: async ({ mastra }) => {
    try {
      const storage = getStorage(mastra);

      // Get the observability store from storage
      const observabilityStore = await storage.getStore('observability');
      if (!observabilityStore) {
        return {
          needsMigration: false,
          hasDuplicates: false,
          duplicateCount: 0,
          constraintExists: true,
          tableName: 'N/A - observability storage not configured',
        };
      }

      // Check if the store has a checkSpansMigrationStatus method
      if (typeof (observabilityStore as any).checkSpansMigrationStatus !== 'function') {
        return {
          needsMigration: false,
          hasDuplicates: false,
          duplicateCount: 0,
          constraintExists: true,
          tableName: 'N/A - migration status not supported for this storage backend',
        };
      }

      // Get the migration status
      const status = await (observabilityStore as any).checkSpansMigrationStatus();
      return status;
    } catch (error) {
      return handleError(error, 'Error getting migration status');
    }
  },
});
