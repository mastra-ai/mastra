import { Mastra } from "@mastra/core";

import * as tools from "./tools";
import { birdAgent } from "./agents";

export const mastra = new Mastra<any, typeof tools, any>({
  tools,
  agents: [birdAgent],
});
