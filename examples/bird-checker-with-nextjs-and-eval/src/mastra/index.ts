import { Mastra } from "@mastra/core";

import { birdAgent } from "./agents";

export const mastra = new Mastra({
  agents: { birdAgent },
});
