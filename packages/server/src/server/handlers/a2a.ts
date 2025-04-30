import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { Context } from '../types';

export async function getAgentCardByIdHandler({
  mastra,
  agentId,
  runtimeContext,
}: Context & { runtimeContext: RuntimeContext; agentId: string }) {
  const agent = mastra.getAgent(agentId);
  console.log({ agent, runtimeContext });
  return {};
}

export async function getAgentExecutionHandler({
  mastra,
  agentId,
  runtimeContext,
}: Context & { runtimeContext: RuntimeContext; agentId: string }) {
  const agent = mastra.getAgent(agentId);
  console.log({ agent, runtimeContext });
  return {};
}
