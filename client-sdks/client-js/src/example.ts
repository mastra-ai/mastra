import z from 'zod';
import { MastraClient } from './client';
// import type { WorkflowRunResult } from './types';

// Agent
(async () => {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  console.log('Starting agent...');

  try {
    const agent = client.getAgent('weatherAgent');
    const response = await agent.stream({
      messages: 'what is the weather in new york?',
      structuredOutput: {
        schema: z.object({
          weather: z.string(),
          temperature: z.number(),
          humidity: z.number(),
          windSpeed: z.number(),
          windDirection: z.string(),
          windGust: z.number(),
          windChill: z.number(),
        }),
      },
    });

    // Process data stream
    response.processDataStream({
      onChunk: async chunk => {
        if (chunk.type === 'text-delta') {
          console.log(chunk.payload.text);
        }
      },
    });

    // read the response body directly

    // const reader = response.body!.getReader();
    // while (true) {
    //   const { done, value } = await reader.read();
    //   if (done) break;
    //   console.log(new TextDecoder().decode(value));
    // }
  } catch (error) {
    console.error(error);
  }
})();

// Workflow
// (async () => {
//   const client = new MastraClient({
//     baseUrl: 'http://localhost:4111',
//   });

//   try {
//     const workflowId = 'weatherWorkflow';
//     const workflow = client.getWorkflow(workflowId);

//     const run = await workflow.createRun();

//     const stream = await run.stream({
//       inputData: {
//         city: 'New York',
//       },
//     });
//     for await (const chunk of stream) {
//       console.log(JSON.stringify(chunk, null, 2));
//     }

//   } catch (e) {
//     console.error('Workflow error:', e);
//   }
// })();
