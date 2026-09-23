import type { Mastra } from '@mastra/core/mastra';
import type { InngestFunction } from 'inngest';
import { isInngestAgent } from './durable-agent';
import { InngestWorkflow } from './workflow';

export function collectInngestFunctions({
  mastra,
  functions: userFunctions = [],
}: {
  mastra: Mastra;
  functions?: InngestFunction.Like[];
}) {
  const workflows = [
    ...Object.values(mastra.listWorkflows()),
    ...Object.values(mastra.listAgents()).flatMap(agent => (isInngestAgent(agent) ? agent.getDurableWorkflows() : [])),
  ];
  const workflowFunctions = new Map<string, InngestFunction.Like>();

  for (const workflow of workflows) {
    if (!(workflow instanceof InngestWorkflow)) continue;

    workflow.__registerMastra(mastra);
    for (const fn of workflow.getFunctions()) {
      const functionId = fn.id();
      if (!workflowFunctions.has(functionId)) {
        workflowFunctions.set(functionId, fn);
      }
    }
  }

  return [...workflowFunctions.values(), ...userFunctions];
}
