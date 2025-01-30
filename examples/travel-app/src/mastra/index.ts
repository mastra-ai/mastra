import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";
import { PostgresEngine } from "@mastra/engine";
import { PgMemory } from "@mastra/memory/postgres";

import { travelAgent, travelAnalyzer } from "./agents";
import { syncCsvDataWorkflow } from "./workflows/attractions";

const url = "postgresql://postgres:postgres@localhost:5433/mastra";

const engine = new PostgresEngine({
  url,
});

// TODO: Change this to match engine PostgresMemory
const memory = new PgMemory({
  connectionString: url,
});

export const mastra = new Mastra({
  workflows: { syncCsvDataWorkflow },
  engine,
  memory,
  agents: { travelAgent, travelAnalyzer },
  logger: createLogger({
    name: "CONSOLE",
    level: "info",
  }),
});
