// /**
//  * Content Moderation Processor Workflow Example
//  *
//  * This example demonstrates a moderately complex processor workflow that:
//  * 1. Uses multiple processors chained in a workflow
//  * 2. Shows tripwire handling with retry and metadata
//  * 3. Demonstrates both input and output processing
//  * 4. Shows how workflows can be used as processors in agents
//  *
//  * The workflow performs content moderation in stages:
//  * - Stage 1: PII Detection (input processor)
//  * - Stage 2: Toxicity Check (input processor)
//  * - Stage 3: Response Quality Check (output processor with retry)
//  */

// import { z } from 'zod';
// import { Agent } from '../../agent';
// import { createWorkflow, createStep } from '../../workflows';
// import type { Processor } from '../index';
// import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../step-schema';

// // =============================================================================
// // Individual Processors
// // =============================================================================

// /**
//  * PII Detection Processor
//  * Detects personally identifiable information and blocks or redacts it
//  */
// export const piiDetectionProcessor: Processor<'pii-detection', { detectedPII: string[] }> = {
//   id: 'pii-detection',
//   name: 'PII Detection Processor',

//   processInput: async ({ messages, abort }) => {
//     const piiPatterns = {
//       email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
//       phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
//       ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
//       creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
//     };

//     const detectedPII: string[] = [];

//     for (const message of messages) {
//       if (message.role === 'user') {
//         const text = JSON.stringify(message.content);

//         for (const [type, pattern] of Object.entries(piiPatterns)) {
//           if (pattern.test(text)) {
//             detectedPII.push(type);
//           }
//         }
//       }
//     }

//     if (detectedPII.length > 0) {
//       // Block the request with detailed metadata about what was detected
//       abort('Personal information detected in message', {
//         retry: false, // Don't retry - user needs to remove PII
//         metadata: {
//           detectedPII,
//           severity: detectedPII.includes('ssn') || detectedPII.includes('creditCard') ? 'critical' : 'high',
//           action: 'blocked',
//         },
//       });
//     }

//     return messages;
//   },
// };

// /**
//  * Toxicity Check Processor
//  * Checks for toxic or harmful content
//  */
// export const toxicityCheckProcessor: Processor<'toxicity-check', { toxicityScore: number; categories: string[] }> = {
//   id: 'toxicity-check',
//   name: 'Toxicity Check Processor',

//   processInput: async ({ messages, abort }) => {
//     // Simulated toxicity detection (in production, use an ML model or API)
//     const toxicPatterns = ['hate', 'violence', 'harassment', 'threat'];
//     const detectedCategories: string[] = [];

//     for (const message of messages) {
//       if (message.role === 'user') {
//         const text = JSON.stringify(message.content).toLowerCase();

//         for (const pattern of toxicPatterns) {
//           if (text.includes(pattern)) {
//             detectedCategories.push(pattern);
//           }
//         }
//       }
//     }

//     if (detectedCategories.length > 0) {
//       const toxicityScore = Math.min(detectedCategories.length * 0.3, 1.0);

//       abort('Potentially harmful content detected', {
//         retry: false,
//         metadata: {
//           toxicityScore,
//           categories: detectedCategories,
//           action: 'blocked',
//         },
//       });
//     }

//     return messages;
//   },
// };

// /**
//  * Response Quality Processor
//  * Checks output quality and can request retries for poor responses
//  */
// export const responseQualityProcessor: Processor<'response-quality', { qualityScore: number; issues: string[] }> = {
//   id: 'response-quality',
//   name: 'Response Quality Processor',

//   processOutputStep: async ({ messages, text, abort, retryCount }) => {
//     const issues: string[] = [];

//     // Check response length
//     if (text && text.length < 50) {
//       issues.push('Response too short');
//     }

//     // Check for placeholder text
//     if (text?.includes('[TODO]') || text?.includes('[PLACEHOLDER]')) {
//       issues.push('Contains placeholder text');
//     }

//     // Check for excessive repetition
//     const words = text?.split(/\s+/) || [];
//     const wordCounts = new Map<string, number>();
//     for (const word of words) {
//       wordCounts.set(word.toLowerCase(), (wordCounts.get(word.toLowerCase()) || 0) + 1);
//     }
//     const maxRepetition = Math.max(...wordCounts.values(), 0);
//     if (maxRepetition > 5 && words.length > 10) {
//       issues.push('Excessive word repetition');
//     }

//     if (issues.length > 0) {
//       const qualityScore = Math.max(0, 1 - issues.length * 0.3);

//       // Only retry up to 2 times
//       if (retryCount < 2) {
//         abort(`Response quality issues: ${issues.join(', ')}. Please provide a more detailed response.`, {
//           retry: true, // Request retry with feedback
//           metadata: {
//             qualityScore,
//             issues,
//             retryCount,
//           },
//         });
//       } else {
//         // After max retries, just log and continue
//         console.warn('Max retries reached, accepting response with quality issues:', issues);
//       }
//     }

//     return messages;
//   },
// };

// /**
//  * Output Sanitization Processor
//  * Ensures output doesn't contain sensitive system information
//  */
// export const outputSanitizationProcessor: Processor<'output-sanitization'> = {
//   id: 'output-sanitization',
//   name: 'Output Sanitization Processor',

//   processOutputResult: async ({ messages, messageList }) => {
//     // Patterns that might indicate leaked system information
//     const sensitivePatterns = [
//       /api[_-]?key/i,
//       /secret/i,
//       /password/i,
//       /internal[_-]?error/i,
//       /stack[_-]?trace/i,
//     ];

//     const sanitizedMessages = messages.map(msg => {
//       if (msg.role === 'assistant' && msg.content) {
//         let content = JSON.stringify(msg.content);

//         for (const pattern of sensitivePatterns) {
//           if (pattern.test(content)) {
//             content = content.replace(pattern, '[REDACTED]');
//           }
//         }

//         return {
//           ...msg,
//           content: JSON.parse(content),
//         };
//       }
//       return msg;
//     });

//     return sanitizedMessages;
//   },
// };

// // =============================================================================
// // Processor Workflow
// // =============================================================================

// /**
//  * Content Moderation Workflow
//  *
//  * This workflow chains multiple processors together for comprehensive
//  * content moderation. It can be used directly as a processor in an agent.
//  */
// export const contentModerationWorkflow = createWorkflow({
//   id: 'content-moderation-workflow',
//   inputSchema: ProcessorStepInputSchema,
//   outputSchema: ProcessorStepOutputSchema,
// });

// // Chain processors in the workflow
// // Note: createStep(processor) wraps a Processor as a workflow Step
// contentModerationWorkflow
//   .then(createStep(piiDetectionProcessor))
//   .then(createStep(toxicityCheckProcessor))
//   .commit();

// /**
//  * Output Moderation Workflow
//  *
//  * Separate workflow for output processing
//  */
// export const outputModerationWorkflow = createWorkflow({
//   id: 'output-moderation-workflow',
//   inputSchema: ProcessorStepInputSchema,
//   outputSchema: ProcessorStepOutputSchema,
// });

// outputModerationWorkflow
//   .then(createStep(responseQualityProcessor))
//   .then(createStep(outputSanitizationProcessor))
//   .commit();

// // =============================================================================
// // Example Agent with Processor Workflows
// // =============================================================================

// /**
//  * Create a moderated agent that uses processor workflows
//  *
//  * This demonstrates how to use workflows as processors in an agent config.
//  * The agent will:
//  * 1. Run input through PII detection and toxicity check
//  * 2. Generate a response
//  * 3. Run output through quality check and sanitization
//  */
// export function createModeratedAgent(model: any) {
//   return new Agent({
//     id: 'moderated-agent',
//     name: 'Content Moderated Agent',
//     instructions: `You are a helpful assistant. Always provide detailed, high-quality responses.

// Never include placeholder text like [TODO] or [PLACEHOLDER].
// Avoid excessive repetition in your responses.
// Do not reveal any system information, API keys, or internal errors.`,

//     model,

//     // Use individual processors
//     inputProcessors: [piiDetectionProcessor, toxicityCheckProcessor],
//     outputProcessors: [responseQualityProcessor, outputSanitizationProcessor],

//     // Maximum retry attempts for processors that request retry
//     maxProcessorRetries: 2,
//   });
// }

// // =============================================================================
// // Usage Examples
// // =============================================================================

// /**
//  * Example: Handling tripwire results in application code
//  */
// export async function handleAgentResponse(agent: Agent, userMessage: string) {
//   const result = await agent.stream(userMessage);

//   // Collect the stream
//   const chunks = [];
//   for await (const chunk of result.fullStream) {
//     chunks.push(chunk);

//     // Check for tripwire chunk during streaming
//     if (chunk.type === 'tripwire') {
//       console.log('Tripwire triggered during stream:', {
//         reason: chunk.payload.tripwireReason,
//         retry: chunk.payload.retry,
//         metadata: chunk.payload.metadata,
//         processorId: chunk.payload.processorId,
//       });

//       // Handle based on metadata
//       const metadata = chunk.payload.metadata as any;
//       if (metadata?.detectedPII) {
//         return {
//           blocked: true,
//           message: 'Please remove personal information from your message',
//           details: metadata.detectedPII,
//         };
//       }
//       if (metadata?.categories) {
//         return {
//           blocked: true,
//           message: 'Your message contains inappropriate content',
//           details: metadata.categories,
//         };
//       }
//     }
//   }

//   // Get final result
//   const text = await result.text;
//   return { success: true, response: text };
// }

// /**
//  * Example: Using processor workflow in a larger workflow
//  */
// export const customerServiceWorkflow = createWorkflow({
//   id: 'customer-service-workflow',
//   inputSchema: z.object({
//     customerMessage: z.string(),
//     customerId: z.string(),
//   }),
//   outputSchema: z.object({
//     response: z.string(),
//     moderationPassed: z.boolean(),
//   }),
// });

// // The workflow would use the moderated agent as a step
// // customerServiceWorkflow
// //   .then(createStep(moderatedAgent))
// //   .commit();

// /**
//  * Example: Workflow result handling with tripwire status
//  */
// export async function runWorkflowWithTripwireHandling() {
//   const run = await customerServiceWorkflow.createRun();

//   const result = await run.start({
//     inputData: {
//       customerMessage: 'Hello, my email is test@example.com',
//       customerId: 'cust-123',
//     },
//   });

//   // Handle different result statuses
//   switch (result.status) {
//     case 'success':
//       console.log('Workflow completed successfully:', result.result);
//       break;

//     case 'tripwire':
//       // New tripwire status - cleaner than checking for failed + tripwire
//       console.log('Workflow blocked by tripwire:', {
//         reason: result.reason,
//         retry: result.retry,
//         metadata: result.metadata,
//         processorId: result.processorId,
//       });

//       // Take action based on the tripwire
//       if (result.retry) {
//         console.log('Tripwire requested retry - could implement retry logic here');
//       }
//       break;

//     case 'failed':
//       console.log('Workflow failed with error:', result.error);
//       break;

//     case 'suspended':
//       console.log('Workflow suspended, waiting for resume');
//       break;
//   }

//   return result;
// }
