import { LibSQLStore } from "@mastra/libsql";

let instance: LibSQLStore | null = null;

export function getStorage() {
  if (!instance) {
    instance = new LibSQLStore({
      url: `file:./mastra.db`,
    });
  }

  return instance;
}
