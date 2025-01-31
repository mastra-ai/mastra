import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { PostgresEngine } from "@mastra/engine";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/store-pg";

import { travelAgent, travelAnalyzer } from "./agents";
import { syncCsvDataWorkflow } from "./workflows/attractions";

const url = "postgresql://postgres:postgres@localhost:5433/mastra";

const engine = new PostgresEngine({
  url,
});

export const mastra = new Mastra({
  workflows: { syncCsvDataWorkflow },
  engine,
  memory: new Memory({
    storage: new PostgresStore({
      connectionString: url,
    }),
  }),
  agents: { travelAgent, travelAnalyzer },
  logger: createLogger({
    name: "CONSOLE",
    level: "info",
  }),
});
