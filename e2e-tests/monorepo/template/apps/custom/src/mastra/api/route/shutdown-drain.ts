import { registerApiRoute } from '@mastra/core/server';

const encoder = new TextEncoder();

export const shutdownDrainRoute = registerApiRoute('/shutdown-drain', {
  method: 'GET',
  handler: async () =>
    new Response(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('started\n'));
          await new Promise(resolve => setTimeout(resolve, 500));
          controller.enqueue(encoder.encode('finished\n'));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/plain' } },
    ),
});
