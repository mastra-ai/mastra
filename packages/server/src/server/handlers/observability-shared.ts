import type { Mastra } from '@mastra/core';
import { coreFeatures } from '@mastra/core/features';
import type { MastraStorage, ObservabilityStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';

export const NEW_OBSERVABILITY_FEATURE = 'observability:v1.13.2';
export const NEW_OBSERVABILITY_UPGRADE_MESSAGE = 'New observability endpoints require @mastra/core >= 1.13.2';

export function isNewObservabilityAvailable(): boolean {
  return coreFeatures.has(NEW_OBSERVABILITY_FEATURE);
}

export function assertNewObservabilityAvailable(): void {
  if (!isNewObservabilityAvailable()) {
    throw new HTTPException(501, { message: NEW_OBSERVABILITY_UPGRADE_MESSAGE });
  }
}

/** Retrieves MastraStorage or throws 500 if unavailable. */
export function getStorage(mastra: Mastra): MastraStorage {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not available' });
  }
  return storage;
}

/** Retrieves the observability storage domain or throws 500 if unavailable. */
export async function getObservabilityStore(mastra: Mastra): Promise<ObservabilityStorage> {
  const storage = getStorage(mastra);
  const observability = await storage.getStore('observability');
  if (!observability) {
    throw new HTTPException(500, { message: 'Observability storage domain is not available' });
  }
  return observability;
}
