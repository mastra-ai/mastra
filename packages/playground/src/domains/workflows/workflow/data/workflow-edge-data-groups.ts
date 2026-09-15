import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';

const edgeDataKey = (edge: WorkflowDataEdgeModel) => edge.data?.boundaryPayload ?? edge.data?.previousStepId;

export function groupWorkflowEdgeData(edges: WorkflowDataEdgeModel[]): WorkflowDataEdgeModel[] {
  const dataGroups = new Map<string, WorkflowDataEdgeModel[]>();
  for (const edge of edges) {
    const key = edgeDataKey(edge);
    if (key === undefined) continue;
    const group = dataGroups.get(key);
    if (group) group.push(edge);
    else dataGroups.set(key, [edge]);
  }

  return edges.map(edge => {
    const key = edgeDataKey(edge);
    const group = key === undefined ? undefined : dataGroups.get(key);
    if (!group || group.length < 2) return edge;
    return {
      ...edge,
      data: { ...edge.data, dataLabelPlacement: group[0].id === edge.id ? 'source' : 'hidden' },
    };
  });
}
