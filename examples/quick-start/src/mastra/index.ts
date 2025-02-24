import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { catOne, agentTwo } from './agents/agent';
import { logCatWorkflow } from './workflow';
import { UpstashTransport } from "@mastra/loggers/upstash";

const logger = createLogger({
  name: "Mastra",
  transports: {
    upstash: new UpstashTransport({
      listName: "production-logs",
      upstashUrl: process.env.UPSTASH_URL!,
      upstashToken: process.env.UPSTASH_TOKEN!,
    })
  },
  level: "debug",
});

export const mastra = new Mastra({
  agents: { catOne, agentTwo },
  workflows: { logCatWorkflow },
  logger,
});
