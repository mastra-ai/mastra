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
      output: z.object({
        weather: z.string(),
        temperature: z.number(),
        humidity: z.number(),
        windSpeed: z.number(),
        windDirection: z.string(),
        windGust: z.number(),
        windChill: z.number(),
      }),
    });

    // Process data stream - unstructured output

    // response.processDataStream({
    //   onTextPart: text => {
    //     process.stdout.write(text);
    //   },
    //   onFilePart: file => {
    //     console.log(file);
    //   },
    //   onDataPart: data => {
    //     console.log(data);
    //   },
    //   onErrorPart: error => {
    //     console.error(error);
    //   },
    //   onToolCallPart(streamPart) {
    //     console.log(streamPart);
    //   },
    // });

    // Process text stream - structured output

    // response.processTextStream({
    //   onTextPart: text => {
    //     process.stdout.write(text);
    //   },
    // });

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
