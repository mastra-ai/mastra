import { createLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import { UpstashTransport } from "@mastra/loggers/upstash";
import { agentOne } from "./agents";
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
  agents: { "openapi-spec-gen-agent": agentOne },
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
