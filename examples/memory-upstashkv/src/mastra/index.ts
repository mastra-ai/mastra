import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/store-upstash';

import { chefAgent } from './agents';

// const kvMemory = new UpstashKVMemory({
//   url: process.env.KV_REST_API_URL!,
//   token: process.env.KV_REST_API_TOKEN!,
// });

export const mastra = new Mastra({
  memory: kvMemory,
  agents: { chefAgent },
});
