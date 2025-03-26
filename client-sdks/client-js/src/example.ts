// import { MastraClient } from './client';
// import type { WorkflowRunResult } from './types';

// Agent

// (async () => {
//   const client = new MastraClient({
//     baseUrl: 'http://localhost:4111',
//   });

//   console.log('Starting agent...');

//   try {
//     const agent = client.getAgent('weatherAgent');
//     const response = await agent.stream({
//       messages: 'what is the weather in new york?',
//     })

//     response.processDataStream({
//       onTextPart: (text) => {
//         process.stdout.write(text);
//       },
//       onFilePart: (file) => {
//         console.log(file);
//       },
//       onDataPart: (data) => {
//         console.log(data);
//       },
//       onErrorPart: (error) => {
//         console.error(error);
//       },
//     });

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
