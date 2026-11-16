import type { CollectionSchema, FactoryStorage } from '@mastra/core/storage';

/**
 * Register collections an earlier release created only to migrate its data forward, and only on a
 * database that already has the first one. A fresh database never gets them; an upgraded one keeps
 * them and their data. A backend that cannot tell whether a table exists creates them as before.
 * Returns whether they were registered, i.e. whether the caller may read or write them.
 */
export async function ensureLegacyCollections(storage: FactoryStorage, schemas: CollectionSchema[]): Promise<boolean> {
  const [marker] = schemas;
  if (!marker) return false;
  if (storage.collectionExists && !(await storage.collectionExists(marker.name))) return false;
  await storage.ensureCollections(schemas);
  return true;
}
