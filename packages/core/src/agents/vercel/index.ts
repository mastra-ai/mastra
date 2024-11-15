// import { createAnthropic } from '@ai-sdk/anthropic';
// import { createOpenAI } from '@ai-sdk/openai';
// import { CoreMessage, generateText, streamText, tool } from 'ai';

// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// function getAgentParams({
//   tools,
//   resultTool,
//   model,
// }: {
//   model: { type: string; name?: string; toolChoice?: any };
//   tools: Record<string, { description: string; parameters: any; execute: any }>;
//   resultTool?: { description: string; parameters: any };
// }) {
//   const toolsConverted = Object.entries(tools).reduce((memo, [key, val]) => {
//     memo[key] = tool(val);
//     return memo;
//   }, {} as Record<string, any>);

//   let answerTool = {};

//   if (resultTool) {
//     answerTool = { answer: tool(resultTool) };
//   }

//   let modelDef: any;

//   if (model.type === 'openai') {
//     let mName = model.name;
//     if (!mName) {
//       mName = `gpt-4o-2024-08-06`;
//     }

//     const openai = createOpenAI({
//       apiKey: process.env.OPENAI_API_KEY,
//     });

//     modelDef = openai(mName, { structuredOutputs: true });
//   } else if (model.type === 'anthropic') {
//     let mName = model.name;
//     if (!mName) {
//       mName = `claude-3-5-sonnet-20240620`;
//     }
//     const anthropic = createAnthropic({
//       apiKey: process.env.ANTHROPIC_API_KEY,
//     });
//     modelDef = anthropic(mName);
//   } else if (model.type === 'groq') {
//     modelDef = createOpenAICompatibleModel(
//       'https://api.groq.com/openai/v1',
//       process.env.GROQ_API_KEY ?? '',
//       'llama-3.2-90b-text-preview',
//       model.name
//     );
//   } else if (model.type === 'perplexity') {
//     modelDef = createOpenAICompatibleModel(
//       'https://api.perplexity.ai/',
//       process.env.PERPLEXITY_API_KEY ?? '',
//       'llama-3.1-sonar-large-128k-chat',
//       model.name
//     );
//   } else if (model.type === 'fireworks') {
//     modelDef = createOpenAICompatibleModel(
//       'https://api.fireworks.ai/inference/v1',
//       process.env.FIREWORKS_API_KEY ?? '',
//       'llama-v3p1-70b-instruct',
//       model.name
//     );
//   }

//   return {
//     toolsConverted,
//     modelDef,
//     answerTool,
//     toolChoice: model?.toolChoice || 'required',
//   };
// }

// export function createStreamAgent({
//   agent_instructions,
//   maxSteps = 5,
//   tools,
//   resultTool,
//   context = [],
//   model,
// }: {
//   model: { type: string; name?: string; toolChoice?: any };
//   tools: Record<string, { description: string; parameters: any; execute: any }>;
//   resultTool?: { description: string; parameters: any };
//   maxSteps?: number;
//   agent_instructions: string;
//   context?: CoreMessage[];
// }) {
//   const params = getAgentParams({
//     tools,
//     resultTool,
//     model,
//   });

//   return async ({ prompt }: { prompt: string }) => {
//     const argsForExecute = {
//       model: params.modelDef,
//       tools: {
//         ...params.toolsConverted,
//         // answer tool: the LLM will provide a structured answer
//         ...params.answerTool,
//         // no execute function - invoking it will terminate the agent
//       },
//       toolChoice: params?.toolChoice || 'required',
//       maxSteps: maxSteps,
//       // system: systemPrompt,
//       onStepFinish: async (props: any) => {
//         console.log(JSON.stringify(props, null, 2));
//         if (
//           props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
//           parseInt(
//             props?.response?.headers?.['x-ratelimit-remaining-tokens'],
//             10
//           ) < 2000
//         ) {
//           console.log('Rate limit reached, waiting 10 seconds');
//           await delay(10 * 1000);
//         }
//       },
//     };

//     return await streamText({
//       messages: [
//         ...context,
//         {
//           role: 'user',
//           content: prompt,
//         },
//         {
//           role: 'system',
//           content: agent_instructions,
//         },
//       ],
//       ...argsForExecute,
//     });
//   };
// }

// export function createAgent({
//   agent_instructions,
//   maxSteps = 5,
//   tools,
//   resultTool,
//   context = [],
//   model,
// }: {
//   model: { type: string; name?: string; toolChoice?: any };
//   tools: Record<string, { description: string; parameters: any; execute: any }>;
//   resultTool?: { description: string; parameters: any };
//   maxSteps?: number;
//   agent_instructions: string;
//   context?: CoreMessage[];
// }) {
//   const params = getAgentParams({
//     tools,
//     resultTool,
//     model,
//   });

//   return async ({ prompt }: { prompt: string }) => {
//     const argsForExecute = {
//       model: params.modelDef,
//       tools: {
//         ...params.toolsConverted,
//         // answer tool: the LLM will provide a structured answer
//         ...params.answerTool,
//         // no execute function - invoking it will terminate the agent
//       },
//       toolChoice: params?.toolChoice || 'required',
//       maxSteps: maxSteps,
//       // system: systemPrompt,
//       onStepFinish: async (props: any) => {
//         console.log(JSON.stringify(props, null, 2));
//         if (
//           props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
//           parseInt(
//             props?.response?.headers?.['x-ratelimit-remaining-tokens'],
//             10
//           ) < 2000
//         ) {
//           console.log('Rate limit reached, waiting 10 seconds');
//           await delay(10 * 1000);
//         }
//       },
//     };

//     const messages: CoreMessage[] = [
//       ...context,
//       {
//         role: 'user',
//         content: prompt,
//       },
//       {
//         role: 'system',
//         content: agent_instructions,
//       },
//     ];

//     return await generateText({
//       messages,
//       ...argsForExecute,
//     });
//   };
// }

// function createOpenAICompatibleModel(
//   baseURL: string,
//   apiKey: string,
//   defaultModelName: string,
//   modelName?: string
// ) {
//   const client = createOpenAI({
//     baseURL,
//     apiKey,
//   });
//   return client(modelName || defaultModelName);
// }
