import { createLogger, Mastra } from "@mastra/core";
import { PostgresEngine } from "@mastra/engine";
import { agentOne } from "./agents";
import * as syncs from "./syncs";

export const mastra = new Mastra({
  logger: createLogger({
    type: "CONSOLE",
  }),
  syncs,
  agents: { agentOne },
  engine: new PostgresEngine({
    url: process.env.DB_URL!,
  }),
  telemetry: {
    serviceName: "mastra-vnext",
    sampling: {
      type: "always_on",
    },
    enabled: true,
    export: {
      type: "otlp",
    },
  },
});
