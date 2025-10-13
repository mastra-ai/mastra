import { LibSQLStore } from "@mastra/libsql";

export const storage = new LibSQLStore({
  id: "travel-app-storage",
  url: "file:mastra.db",
});
