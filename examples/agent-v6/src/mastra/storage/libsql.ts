import { LibSQLStore } from '@mastra/libsql';
import { resolveFromProjectRoot } from '@mastra/core/utils';

export const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: `file:${resolveFromProjectRoot('./data/mastra.db')}`,
});
