import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { Context } from '../types';
import type { TaskSendParams, TaskQueryParams, TaskIdParams } from '@mastra/core/a2a';

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
