/**
 * Inngest DurableAgent Module
 *
 * Provides durable AI agent execution through Inngest's execution engine.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createInngestAgent, serve as inngestServe } from '@mastra/inngest';
 * import { Mastra } from '@mastra/core/mastra';
 * import { Inngest } from 'inngest';
 * import { realtimeMiddleware } from '@inngest/realtime/middleware';
 *
 * const inngest = new Inngest({
 *   id: 'my-app',
 *   middleware: [realtimeMiddleware()],
 * });
 *
 * // 1. Create a regular Mastra agent
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * // 2. Wrap it with Inngest durable execution
 * const durableAgent = createInngestAgent({ agent, inngest });
 *
 * // 3. Register with Mastra (workflow is auto-registered)
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
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
 * const { output, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */

// Factory function for creating Inngest durable agents
export {
  createInngestAgent,
  isInngestAgent,
  type InngestAgent,
  type CreateInngestAgentOptions,
  type InngestAgentStreamOptions,
  type InngestAgentStreamResult,
} from './create-inngest-agent';

// Workflow factory (internal, used by createInngestAgent)
export {
  createInngestDurableAgenticWorkflow,
  type InngestDurableAgenticWorkflowOptions,
} from './create-inngest-agentic-workflow';
