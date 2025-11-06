import { LibSQLStore } from "@mastra/libsql";

export const storage = new LibSQLStore({
  url: "file:mastra.db",
});
