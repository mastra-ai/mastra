import { LibSQLStore } from '@mastra/libsql';

export const isVersionLabelE2EMode = process.env.E2E_VERSION_LABELS_LIBSQL_AGENTS === '1';

export const storage = new LibSQLStore({
  id: 'e2e-test-storage',
  url: isVersionLabelE2EMode ? 'file:e2e-version-labels-storage.db' : 'file:e2e-test-storage.db',
});

export async function initE2EStorage() {
  await storage.init();

  const workflowStore = await storage.getStore('workflows');
  await workflowStore?.init?.();
}
