import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';

const edgeDataKey = ({ data }: WorkflowDataEdgeModel) => {
  if (data?.boundaryPayload !== undefined) return `boundary:${data.boundaryPayload}`;
  if (data?.previousStepId !== undefined) return `step:${data.previousStepId}`;
  return undefined;
};

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
