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
  const workflows = mastra.listWorkflows();
  const workflowFunctions = Array.from(
    new Set(
      Object.values(workflows).flatMap(workflow => {
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
