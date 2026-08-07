import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  id: 'e2e-test-storage',
  url: 'file:e2e-test-storage.db',
});

export async function initE2EStorage() {
  await storage.init();

  const workflowStore = await storage.getStore('workflows');
  await workflowStore?.init?.();
}
