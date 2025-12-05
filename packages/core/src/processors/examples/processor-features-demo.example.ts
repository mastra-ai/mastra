// /**
//  * Processor Features Demo
//  *
//  * This example demonstrates all the key processor features we've built:
//  *
//  * 1. TripWire with retry and metadata
//  * 2. processOutputStep for per-step output processing
//  * 3. Processor workflows (using processors in workflows)
//  * 4. Workflow tripwire status
//  * 5. Workflows as processors in agents
//  */

// import { z } from 'zod';
// import { Agent } from '../../agent';
// import { createWorkflow, createStep } from '../../workflows';
// import type { Processor } from '../index';
// import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../step-schema';

// // =============================================================================
// // Feature 1: TripWire with retry and metadata
// // =============================================================================

// /**
//  * Processor that demonstrates tripwire with retry capability.
//  * If the response doesn't meet quality standards, it requests a retry
//  * with feedback that gets added to the conversation.
//  */
// const qualityGuardProcessor: Processor<'quality-guard', { score: number; feedback: string }> = {
//   id: 'quality-guard',
//   name: 'Quality Guard',

//   processOutputStep: async ({ text, abort, retryCount }) => {
//     // Simple quality check: ensure response is substantial
//     const wordCount = text?.split(/\s+/).length || 0;

//     if (wordCount < 20 && retryCount < 2) {
//       // Request retry with typed metadata
//       abort('Response is too brief. Please provide more detail.', {
//         retry: true,
//         metadata: {
//           score: wordCount / 50,
//           feedback: `Only ${wordCount} words. Aim for at least 20 words.`,
//         },
//       });
//     }

//     // Return messages unchanged if quality is acceptable
//     return [];
//   },
// };

// /**
//  * Processor that blocks requests containing sensitive topics.
//  * Does NOT request retry - this is a hard block.
//  */
// const contentFilterProcessor: Processor<'content-filter', { blockedTerms: string[] }> = {
//   id: 'content-filter',
//   name: 'Content Filter',

//   processInput: async ({ messages, abort }) => {
//     const blockedTerms = ['password', 'api-key', 'secret'];
//     const foundTerms: string[] = [];

//     for (const msg of messages) {
//       const text = JSON.stringify(msg.content).toLowerCase();
//       for (const term of blockedTerms) {
//         if (text.includes(term)) {
//           foundTerms.push(term);
//         }
//       }
//     }

//     if (foundTerms.length > 0) {
//       // Hard block - no retry
//       abort('Request contains sensitive information', {
//         retry: false,
//         metadata: {
//           blockedTerms: foundTerms,
//         },
//       });
//     }

//     return messages;
//   },
// };

// // =============================================================================
// // Feature 2: processOutputStep - Per-step output processing
// // =============================================================================

// /**
//  * Processor that runs after each LLM step, before tool execution.
//  * Useful for validating responses before tools run.
//  */
// const stepValidatorProcessor: Processor<'step-validator'> = {
//   id: 'step-validator',
//   name: 'Step Validator',

//   processOutputStep: async ({ stepNumber, finishReason, toolCalls, text, messages }) => {
//     console.log(`Step ${stepNumber} completed:`, {
//       finishReason,
//       hasToolCalls: toolCalls && toolCalls.length > 0,
//       responseLength: text?.length,
//     });

//     // Example: Block certain tool calls
//     if (toolCalls?.some(tc => tc.toolName === 'dangerous_tool')) {
//       // This would trigger a tripwire - but we'll just log for demo
//       console.warn('Blocked dangerous tool call');
//     }

//     return messages;
//   },
// };

// // =============================================================================
// // Feature 3: Processor Workflows - Chain processors in workflows
// // =============================================================================

// /**
//  * Create a moderation workflow by chaining processors.
//  * The workflow can then be used as a processor itself.
//  */
// const moderationWorkflow = createWorkflow({
//   id: 'moderation-pipeline',
//   inputSchema: ProcessorStepInputSchema,
//   outputSchema: ProcessorStepOutputSchema,
// });

// // Chain processors: content filter -> (messages flow through)
// moderationWorkflow.then(createStep(contentFilterProcessor)).commit();

// // =============================================================================
// // Feature 4: Workflow Tripwire Status
// // =============================================================================

// /**
//  * Example showing how workflow results include tripwire status.
//  *
//  * When a processor in a workflow triggers a tripwire, the workflow
//  * returns status: 'tripwire' with all the tripwire details.
//  */
// async function demonstrateWorkflowTripwire() {
//   const workflow = createWorkflow({
//     id: 'tripwire-demo-workflow',
//     inputSchema: z.object({ prompt: z.string() }),
//     outputSchema: z.object({ text: z.string() }),
//   });

//   // Add a processor step that will trigger tripwire
//   const blockingProcessor: Processor = {
//     id: 'blocker',
//     processInput: async ({ abort }) => {
//       abort('Demo tripwire', { retry: true, metadata: { demo: true } });
//     },
//   };

//   workflow.then(createStep(blockingProcessor)).commit();

//   const run = await workflow.createRun();
//   const result = await run.start({ inputData: { prompt: 'test' } });

//   // Result has status: 'tripwire' with fields directly on the result
//   if (result.status === 'tripwire') {
//     console.log('Tripwire Result:', {
//       status: result.status,
//       reason: result.reason, // "Demo tripwire"
//       retry: result.retry, // true
//       metadata: result.metadata, // { demo: true }
//       processorId: result.processorId, // "blocker"
//     });
//   }

//   return result;
// }

// // =============================================================================
// // Feature 5: Workflows as Processors in Agents
// // =============================================================================

// /**
//  * Create an agent that uses a workflow as an input processor.
//  * This allows complex processor pipelines to be encapsulated in workflows.
//  */
// function createAgentWithWorkflowProcessor(model: any) {
//   return new Agent({
//     id: 'workflow-processor-agent',
//     name: 'Agent with Workflow Processor',
//     instructions: 'You are helpful.',
//     model,

//     // Use individual processors
//     inputProcessors: [contentFilterProcessor],

//     // Output processors run after generation
//     outputProcessors: [qualityGuardProcessor],

//     // Max retries when processors request retry
//     maxProcessorRetries: 3,
//   });
// }

// // =============================================================================
// // Feature Demo: Agent in Workflow with Tripwire Bubbling
// // =============================================================================

// /**
//  * When an agent runs inside a workflow and its processor triggers a tripwire,
//  * the tripwire bubbles up to the workflow level.
//  */
// async function demonstrateAgentTripwireBubbling(model: any) {
//   // Create agent with tripwire-triggering processor
//   const agent = new Agent({
//     id: 'tripwire-agent',
//     name: 'Tripwire Agent',
//     instructions: 'You are helpful.',
//     model,
//     inputProcessors: [
//       {
//         id: 'always-block',
//         processInput: async ({ abort }) => {
//           abort('Blocked for demo', { metadata: { source: 'agent-processor' } });
//         },
//       },
//     ],
//   });

//   // Create workflow that uses the agent
//   const workflow = createWorkflow({
//     id: 'agent-workflow',
//     inputSchema: z.object({ prompt: z.string() }),
//     outputSchema: z.object({ text: z.string() }),
//   });

//   workflow.then(createStep(agent)).commit();

//   const run = await workflow.createRun();
//   const result = await run.start({ inputData: { prompt: 'Hello' } });

//   // The tripwire from the agent's processor bubbles up to the workflow
//   if (result.status === 'tripwire') {
//     console.log('Agent tripwire bubbled to workflow:', {
//       reason: result.reason, // "Blocked for demo"
//       metadata: result.metadata, // { source: 'agent-processor' }
//       processorId: result.processorId, // "always-block"
//     });
//   }

//   return result;
// }

// // =============================================================================
// // Complete Example: Full Pipeline
// // =============================================================================

// /**
//  * Complete example showing all features together
//  */
// export async function fullPipelineExample(model: any) {
//   // 1. Create processors
//   const inputFilter: Processor = {
//     id: 'input-filter',
//     processInput: async ({ messages, abort }) => {
//       // Check for blocked content
//       const text = JSON.stringify(messages);
//       if (text.includes('blocked-word')) {
//         abort('Blocked content', {
//           retry: false,
//           metadata: { reason: 'contains blocked word' },
//         });
//       }
//       return messages;
//     },
//   };

//   const outputQuality: Processor = {
//     id: 'output-quality',
//     processOutputStep: async ({ text, abort, retryCount }) => {
//       if (text && text.length < 10 && retryCount < 2) {
//         abort('Response too short', {
//           retry: true,
//           metadata: { length: text.length, minLength: 10 },
//         });
//       }
//       return [];
//     },
//   };

//   // 2. Create agent with processors
//   const agent = new Agent({
//     id: 'demo-agent',
//     name: 'Demo Agent',
//     instructions: 'Provide detailed responses.',
//     model,
//     inputProcessors: [inputFilter],
//     outputProcessors: [outputQuality],
//     maxProcessorRetries: 2,
//   });

//   // 3. Use agent directly
//   console.log('--- Direct Agent Usage ---');
//   try {
//     const result = await agent.stream('Tell me about TypeScript');
//     for await (const chunk of result.fullStream) {
//       if (chunk.type === 'tripwire') {
//         console.log('Tripwire:', chunk.payload);
//       }
//     }
//     console.log('Response:', await result.text);
//   } catch (e) {
//     console.log('Error:', e);
//   }

//   // 4. Use agent in workflow
//   console.log('\n--- Agent in Workflow ---');
//   const workflow = createWorkflow({
//     id: 'demo-workflow',
//     inputSchema: z.object({ prompt: z.string() }),
//     outputSchema: z.object({ text: z.string() }),
//   });

//   workflow.then(createStep(agent)).commit();

//   const run = await workflow.createRun();
//   const workflowResult = await run.start({ inputData: { prompt: 'Hello world' } });

//   console.log('Workflow result status:', workflowResult.status);
//   if (workflowResult.status === 'tripwire') {
//     console.log('Tripwire details:', {
//       reason: workflowResult.reason,
//       retry: workflowResult.retry,
//       metadata: workflowResult.metadata,
//       processorId: workflowResult.processorId,
//     });
//   } else if (workflowResult.status === 'success') {
//     console.log('Success:', workflowResult.result);
//   }

//   return workflowResult;
// }

// // Export for testing
// export {
//   qualityGuardProcessor,
//   contentFilterProcessor,
//   stepValidatorProcessor,
//   moderationWorkflow,
//   demonstrateWorkflowTripwire,
//   createAgentWithWorkflowProcessor,
//   demonstrateAgentTripwireBubbling,
// };
