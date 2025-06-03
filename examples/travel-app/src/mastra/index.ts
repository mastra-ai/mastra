import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { travelAgent, travelAnalyzer } from "./agents";
import { syncCsvDataWorkflow } from "./workflows/attractions";
import { storage } from "./agents/storage";

export const mastra = new Mastra({
  workflows: { syncCsvDataWorkflow },
  storage,
  agents: { travelAgent, travelAnalyzer },
  logger: new PinoLogger({
    name: "CONSOLE",
    level: "info",
  }),
});
