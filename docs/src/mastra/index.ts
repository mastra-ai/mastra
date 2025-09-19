import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { summarizer } from "./agents/summarizer";

export const mastra = new Mastra({
  agents: { summarizer },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
