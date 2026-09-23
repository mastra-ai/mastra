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
  /**
   * Inngest agents share the same logical durable workflow IDs and resolve the
   * concrete agent from the workflow input, so only the first registered
   * agent's workflow needs to be served.
   */
  const durableAgent = Object.values(mastra.listAgents()).find(agent => isInngestAgent(agent));
  const workflows = [
    ...Object.values(mastra.listWorkflows()),
    ...(durableAgent?.getDurableWorkflows() ?? []),
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
