import type { Mastra } from '@mastra/core/mastra';
import type { InngestFunction } from 'inngest';
import { InngestWorkflow } from './workflow';

export function collectInngestFunctions({
  mastra,
  functions: userFunctions = [],
}: {
  mastra: Mastra;
  functions?: InngestFunction.Like[];
}) {
  const workflows = Object.values(mastra.listWorkflows());
  // Mastra hides each durable agent's backing loop workflow from listWorkflows()
  // because it is internal plumbing, but Inngest still has to serve it.
  const durableAgentWorkflows = Object.values(mastra.listAgents()).flatMap(
    agent => (agent as { getDurableWorkflows?: () => unknown[] }).getDurableWorkflows?.() ?? [],
  );
  const workflowFunctions = Array.from(
    new Set(
      Array.from(new Set([...workflows, ...durableAgentWorkflows])).flatMap(workflow => {
        if (workflow instanceof InngestWorkflow) {
          workflow.__registerMastra(mastra);
          return workflow.getFunctions();
        }
        return [];
      }),
    ),
  );

  return [...workflowFunctions, ...userFunctions];
}
