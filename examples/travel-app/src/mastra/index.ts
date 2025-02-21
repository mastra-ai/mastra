import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";

import { travelAgent, travelAnalyzer } from "./agents";
import { syncCsvDataWorkflow } from "./workflows/attractions";
import { storage } from "./agents/storage";

export const mastra = new Mastra({
  workflows: { syncCsvDataWorkflow },
  storage,
  agents: { travelAgent, travelAnalyzer },
  logger: createLogger({
    name: "CONSOLE",
    level: "info",
  }),
});
