import { LibSQLStore } from '@mastra/libsql';

export default new LibSQLStore({
  id: 'file-based-agents-storage',
  url: 'file:./mastra.db',
});
