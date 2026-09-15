import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';

function edgeDataSourceKey(edge: WorkflowDataEdgeModel) {
  if (!edge.data?.previousStepId && !edge.data?.boundaryPayload) return undefined;
  return JSON.stringify([edge.source, edge.sourceHandle, edge.data.previousStepId, edge.data.boundaryPayload]);
}

export function groupWorkflowEdgeData(edges: WorkflowDataEdgeModel[]): WorkflowDataEdgeModel[] {
  const sourceGroups = new Map<string, WorkflowDataEdgeModel[]>();
  for (const edge of edges) {
    const key = edgeDataSourceKey(edge);
    if (key === undefined) continue;
    const group = sourceGroups.get(key);
    if (group) group.push(edge);
    else sourceGroups.set(key, [edge]);
  }

  return edges.map(edge => {
    const key = edgeDataSourceKey(edge);
    const group = key === undefined ? undefined : sourceGroups.get(key);
    if (!group || group.length < 2) return edge;
    return {
      ...edge,
      data: { ...edge.data, dataLabelPlacement: group[0].id === edge.id ? 'source' : 'hidden' },
    };
  });
}
