import { MastraClient } from './client';
import type { WorkflowRunResult } from './types';

// Agent

// (async () => {
//   const client = new MastraClient({
//     baseUrl: 'http://localhost:4111',
//   });

//   try {
//     const agent = client.getAgent('weatherAgent');
//     const response = await agent.stream({
//       messages: [
//         {
//           role: 'user',
//           content: 'Hello, world!',
//         },
//       ],
//     });

//     const reader = response?.body?.getReader();
//     const decoder = new TextDecoder();
//     let buffer = '';

//     while (true) {
//       if (!reader) break;
//       const { value, done } = await reader.read();
//       if (done) break;

//       const chunk = decoder.decode(value);
//       buffer += chunk;

//       console.log(buffer);

//       const matches = buffer.matchAll(/0:"([^"]*)"/g);

//       for (const match of matches) {
//         const content = match[1];
//         process.stdout.write(`${content}\n`);
//       }
//     }
//   } catch (error) {
//     console.error(error);
//   }
// })();

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
