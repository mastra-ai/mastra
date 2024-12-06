import { createLogger, Mastra, UpstashRedisLogger } from "@mastra/core";
import { agentOne } from "./agents";
import { integrations } from "./integrations";
import * as tools from "./tools";
import * as syncs from "./syncs";
import { PostgresEngine } from "@mastra/engine";

export const mastra = new Mastra<
  typeof integrations,
  typeof tools,
  typeof syncs,
  UpstashRedisLogger
>({
  integrations,
  logger: createLogger({
    type: "UPSTASH",
    token: process.env.UPSTASH_API_KEY!,
    url: process.env.UPSTASH_URL!,
  }),
  syncs,
  agents: [agentOne],
  tools,
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
