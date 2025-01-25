import { createLogger, Mastra } from "@mastra/core";
import { UpstashTransport } from "@mastra/loggers";
import { PostgresEngine } from "@mastra/engine";
import { agentOne } from "./agents";
import * as syncs from "./syncs";
import { makePRToMastraWorkflow, openApiSpecGenWorkflow } from "./workflows";

export const mastra = new Mastra({
  logger: createLogger({
    name: "OPENAPI_SPEC_WRITER",
    level: "debug",
    transports: {
      upstash: new UpstashTransport({
        upstashToken: process.env.UPSTASH_API_KEY!,
        upstashUrl: process.env.UPSTASH_URL!,
      }),
    },
  }),
  syncs,
  agents: { "openapi-spec-gen-agent": agentOne },
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
  workflows: {
    openApiSpecGenWorkflow,
    makePRToMastraWorkflow,
  },
});
