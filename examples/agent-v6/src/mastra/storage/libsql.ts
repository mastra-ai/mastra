import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: `file:./data/mastra.db`,
});
