import { Mastra, createLogger } from "@mastra/core";
import { PostgresEngine } from "@mastra/engine";
import { PgMemory } from "@mastra/memory";

import { travelAgent, travelAnalyzer } from "./agents";
import { syncCsvData } from "./syncs/attractions";

const url = "postgresql://postgres:postgres@localhost:5433/mastra";

const engine = new PostgresEngine({
  url,
});

// TODO: Change this to match engine PostgresMemory
const memory = new PgMemory({
  connectionString: url,
});

export const mastra = new Mastra({
  syncs: { syncCsvData },
  engine,
  memory,
  agents: { travelAgent, travelAnalyzer },
  logger: createLogger({
    name: "CONSOLE",
    level: "info",
  }),
});
