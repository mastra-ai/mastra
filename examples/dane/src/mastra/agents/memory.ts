import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';

export const memory = new Memory({
  storage: new UpstashStore({
    url: 'http://localhost:8079',
    token: `example_token`,
    // TODO: do we need to implement this in Memory?
    // maxTokens: 39000,
  }),
});
