import { PinoLogger } from "@mastra/loggers";
import { Mastra } from "@mastra/core";
import { UpstashTransport } from "@mastra/loggers/upstash";
import { agentOne } from "./agents";
import { makePRToMastraWorkflow, openApiSpecGenWorkflow } from "./workflows";

export const mastra = new Mastra({
  logger: new PinoLogger({
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
  workflows: {
    openApiSpecGenWorkflow,
    makePRToMastraWorkflow,
  },
});
