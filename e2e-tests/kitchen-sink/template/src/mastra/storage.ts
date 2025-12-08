import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  id: 'e2e-test-storage',
  url: ':memory:',
});
