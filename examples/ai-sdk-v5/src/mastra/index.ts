import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";

import { weatherAgent } from "./agents";

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
