import { MastraClient } from './client';

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

// Network

// (async () => {
//   const client = new MastraClient({
//     baseUrl: 'http://localhost:4111',
//   });

//   try {
//     // Get all networks
//     const networks = await client.getNetworks();
//     console.log('Available networks:', Object.keys(networks));

//     // Get a specific network
//     const network = client.getNetwork('myNetwork');

//     // Generate a response
//     const response = await network.generate({
//       input: 'What is the weather like today?',
//     });
//     console.log('Network response:', response);

//     // Stream a response
//     console.log('Streaming response:');
//     for await (const chunk of network.streamReader({
//       input: 'Tell me about climate change',
//     })) {
//       console.log(chunk);
//     }
//   } catch (error) {
//     console.error('Error:', error);
//   }
// })();

// Workflow

// (async () => {
//   const client = new MastraClient({
//     baseUrl: 'http://localhost:4111',
//   });

//   const workflowId = 'weatherWorkflow';

//   const workflow = client.getWorkflow(workflowId);
//   const response = workflow.watch();

//   workflow.execute({
//     city: 'New York',
//   });

//   for await (const record of response) {
//     console.log(new Date().toTimeString(), record);
//   }
// })();
