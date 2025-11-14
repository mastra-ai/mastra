import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

const agent = client.getAgent('errorAgent');
const result = await agent.stream('Hey whats up?');

result.processDataStream({
  onChunk: async chunk => {
    if (chunk.type === 'error') {
      console.log('processDataStream error', chunk.payload.error);
    }
  },
});
