import { ConsoleLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";

import { weatherAgent } from "./agents";

export const mastra = new Mastra({
  agents: { weatherAgent },
  logger: new ConsoleLogger(),
  // aiSdkCompat: "v4",
});
