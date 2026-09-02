import { InMemoryStore } from '@mastra/core/storage';

export const storage = new InMemoryStore({ id: 'e2e-test-storage' });

export async function initE2EStorage() {
  await storage.init();
}
