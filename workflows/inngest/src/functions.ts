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
  // Mastra hides each durable agent's backing loop workflow from listWorkflows()
  // because it is internal plumbing, but Inngest still has to serve it.
  const durableAgentWorkflows = Object.values(mastra.listAgents()).flatMap(
    agent => (agent as { getDurableWorkflows?: () => unknown[] }).getDurableWorkflows?.() ?? [],
  );
  // Every createInngestAgent() call builds its own copy of the loop workflow under
  // the same id, so dedupe by id (first wins, like Mastra.addWorkflow) to keep
  // Inngest function ids unique.
  const workflowsById = new Map<string, InngestWorkflow>();
  for (const workflow of [...Object.values(mastra.listWorkflows()), ...durableAgentWorkflows]) {
    if (workflow instanceof InngestWorkflow && !workflowsById.has(workflow.id)) {
      workflowsById.set(workflow.id, workflow);
    }
  }
  const workflowFunctions = Array.from(workflowsById.values()).flatMap(workflow => {
    workflow.__registerMastra(mastra);
    return workflow.getFunctions();
  });

  return [...workflowFunctions, ...userFunctions];
}
