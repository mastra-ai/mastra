import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAgent } from "./agents";

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    id: "ai-sdk-v5-storage",
    url: `:memory:`,
  }),
});
