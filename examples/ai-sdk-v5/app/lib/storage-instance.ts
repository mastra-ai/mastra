import { LibSQLStore } from "@mastra/libsql";

let instance: LibSQLStore | null = null;

export function getStorage() {
  if (!instance) {
    instance = new LibSQLStore({
      id: "ai-sdk-v5-storage",
      url: `file:./mastra.db`,
    });
  }

  return instance;
}
