import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'https://millions-substantial-monit-studio.mastra.cloud',
});

const d = await client.listMemoryThreads({
  resourceId: 'weatherAgent',
  agentId: 'weatherAgent',
});

console.log(d);
