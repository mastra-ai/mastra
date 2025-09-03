import { registerApiRoute } from '@mastra/core/server';
import { streamSSE } from 'hono/streaming';

let id = 0;

export const streamingRoute = registerApiRoute('/streaming', {
  method: 'GET',
  handler: async c => {
    return streamSSE(c, async stream => {
      while (true) {
        const message = `It is ${new Date().toISOString()}`;
        await stream.writeSSE({
          data: message,
          event: 'time-update',
          id: String(id++),
        });
        await stream.sleep(1000);
      }
    });
  },
});
