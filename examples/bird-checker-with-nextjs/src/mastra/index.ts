import { Mastra } from "@mastra/core/mastra";
import { birdAgent } from "./agents";

export const mastra = new Mastra({
  agents: { birdAgent },
});
