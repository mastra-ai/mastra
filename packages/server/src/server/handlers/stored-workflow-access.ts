import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/di';

import { HTTPException } from '../http-exception';
import { assertExecuteAccess } from './authorship';

type GraphEntry = {
  type?: string;
  workflowId?: string;
  steps?: GraphEntry[];
  step?: GraphEntry;
};

function collectNestedWorkflowIds(graph: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(graph)) return ids;

  const visit = (entry: GraphEntry) => {
    if (entry.type === 'workflow' && typeof entry.workflowId === 'string') {
      ids.add(entry.workflowId);
      return;
    }
    if ((entry.type === 'parallel' || entry.type === 'conditional') && Array.isArray(entry.steps)) {
      entry.steps.forEach(visit);
      return;
    }
    if ((entry.type === 'loop' || entry.type === 'foreach') && entry.step) {
      visit(entry.step);
    }
  };

  graph.forEach(entry => visit(entry as GraphEntry));
  return ids;
}

export async function assertStoredWorkflowExecuteAccess({
  mastra,
  workflowId,
  requestContext,
}: {
  mastra: Mastra;
  workflowId: string;
  requestContext: RequestContext;
}): Promise<void> {
  const storage = mastra.getStorage();
  const store = await storage?.getStore('workflowDefinitions');
  const visited = new Set<string>();

  const visit = async (id: string): Promise<void> => {
    if (visited.has(id)) return;
    visited.add(id);

    const definition = await store?.get(id);
    if (!definition) {
      if (mastra.getWorkflowOrigin(id) === 'dynamic') {
        throw new HTTPException(404, { message: 'Workflow not found' });
      }
      return;
    }

    assertExecuteAccess({
      requestContext,
      resource: 'stored-workflows',
      resourceId: id,
      record: definition,
    });

    await Promise.all([...collectNestedWorkflowIds(definition.graph)].map(visit));
  };

  await visit(workflowId);
}
