import { Mastra } from '@mastra/core';

import { chefAgent } from './agents';

// When you register an agent with Mastra, they get access to the logger and any configured tools or integrations, as we will explore in the following sections.
export const mastra = new Mastra({
  agents: [chefAgent],
});


