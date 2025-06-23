import { createTool } from '@mastra/core';
import { MastraClient } from './client';
import z from 'zod';
// import type { WorkflowRunResult } from './types';

// Agent
(async () => {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });
  const weatherTool = createTool({
    id: 'weatherTool',
    description: 'Get the weather in a city',
    execute: async ({ context }) => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return {
        weather: `The weather in ${context.city} is sunny`,
      };
    },
    inputSchema: z.object({
      city: z.string(),
    }),
    outputSchema: z.object({
      weather: z.string(),
    }),
  });

  console.log('Starting agent...');

  try {
    const agent = client.getAgent('weatherAgent');
    const response = await agent.stream({
      messages: 'what is the weather in new york?',
      // clientTools: {
      //   weatherTool,
      // },
    });

    response.processDataStream({
      onTextPart: text => {
        process.stdout.write(text);
      },
      onFilePart: file => {
        console.log(file);
      },
      onDataPart: data => {
        console.log(data);
      },
      onErrorPart: error => {
        console.error(error);
      },
      onToolCallPart(streamPart) {
        console.log(streamPart);
      },
    });
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
//     const workflowId = 'myWorkflow';
//     const workflow = client.getWorkflow(workflowId);

//     const { runId } = await workflow.createRun();

//     workflow.watch({ runId }, record => {
//       console.log(new Date().toTimeString(), record);
//     });

//     await workflow.start({
//       runId,
//       triggerData: {
//         city: 'New York',
//       },
//     });

//   } catch (e) {
//     console.error('Workflow error:', e);
//   }
// })();
