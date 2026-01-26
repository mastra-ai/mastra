/**
 * Inngest DurableAgent Module
 *
 * Provides durable AI agent execution through Inngest's execution engine.
 *
 * @example
 * ```typescript
 * import {
 *   InngestDurableAgent,
 *   createInngestDurableAgenticWorkflow,
 *   serve as inngestServe
 * } from '@mastra/inngest';
 * import { Mastra } from '@mastra/core/mastra';
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({ id: 'my-app' });
 *
 * // 1. Create the shared workflow (once per app)
 * const durableAgentWorkflow = createInngestDurableAgenticWorkflow({ inngest });
 *
 * // 2. Create agents
 * const agent = new InngestDurableAgent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 *   inngest,
 * });
 *
 * // 3. Initialize agent and register with Mastra
 * await agent.prepare([{ role: 'user', content: 'init' }]);
 *
 * const mastra = new Mastra({
 *   agents: { [agent.id]: agent.agent },
 *   workflows: { [durableAgentWorkflow.id]: durableAgentWorkflow },
 *   server: {
 *     apiRoutes: [{
 *       path: '/inngest/api',
 *       method: 'ALL',
 *       createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
 *     }],
 *   },
 * });
 *
 * // 4. Use the agent
 * const { output, cleanup } = await agent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */

// Main InngestDurableAgent class
export {
  InngestDurableAgent,
  type InngestDurableAgentConfig,
  type InngestDurableAgentStreamOptions,
  type InngestDurableAgentStreamResult,
} from './inngest-durable-agent';

// Workflow factory
export {
  createInngestDurableAgenticWorkflow,
  type InngestDurableAgenticWorkflowOptions,
} from './create-inngest-agentic-workflow';
