import type { TaskSendParams, TaskQueryParams, TaskIdParams, AgentCard } from '@mastra/core/a2a';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { Context } from '../types';

export async function getAgentCardByIdHandler({
  mastra,
  agentId,
  // We need to keep runtimeContext in the parameters even if unused
  // to match the expected function signature
  runtimeContext,
}: Context & { runtimeContext: RuntimeContext; agentId: string }): Promise<AgentCard> {
  const agent = mastra.getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }

  const instructions = await agent.getInstructions({ runtimeContext });
  const tools = await agent.getTools({ runtimeContext });

  // Extract agent information to create the AgentCard
  const agentCard: AgentCard = {
    name: agent.id || agentId,
    description: instructions,
    url: `/a2a/${agentId}`,
    //TODO
    provider: {
      organization: 'Mastra',
      url: 'https://mastra.ai',
    },
    version: '1.0',
    capabilities: {
      streaming: true, // All agents support streaming
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    // Convert agent tools to skills format for A2A protocol
    skills: Object.entries(tools).map(([toolId, tool]) => ({
      id: toolId,
      name: toolId,
      description: tool.description || `Tool: ${toolId}`,
      // Optional fields
      tags: ['tool'],
    })),
  };

  return agentCard;
}

export async function getAgentExecutionHandler({
  mastra,
  agentId,
  runtimeContext,
  method,
  params,
}: Context & {
  runtimeContext: RuntimeContext;
  agentId: string;
  method: 'tasks/send' | 'tasks/sendSubscribe' | 'tasks/get' | 'tasks/cancel';
  params: TaskSendParams | TaskQueryParams | TaskIdParams;
}) {
  const agent = mastra.getAgent(agentId);
  console.log({ agent, runtimeContext, method, params });
  return {};
}
