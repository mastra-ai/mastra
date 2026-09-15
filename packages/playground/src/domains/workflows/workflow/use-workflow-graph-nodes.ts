import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { applyNodeChanges } from '@xyflow/react';
import type { NodeChange } from '@xyflow/react';
import { useState } from 'react';
import { constructNodesAndEdges } from './utils';
import type { WorkflowGraphNode } from './utils';
import { getLayoutedElements } from './workflow-graph-layout';

const findMostResizedNode = (changes: NodeChange<WorkflowGraphNode>[], nodes: WorkflowGraphNode[]) => {
  let mostResizedNode: WorkflowGraphNode | undefined;
  let largestResize = 0;
  for (const change of changes) {
    if (change.type !== 'dimensions' || !change.dimensions) continue;
    const node = nodes.find(candidate => candidate.id === change.id);
    if (!node) continue;
    const resize =
      Math.abs(change.dimensions.width - (node.measured?.width ?? 0)) +
      Math.abs(change.dimensions.height - (node.measured?.height ?? 0));
    if (resize <= largestResize) continue;
    largestResize = resize;
    mostResizedNode = node;
  }
  return mostResizedNode;
};

export function useWorkflowGraphNodes(stepGraph: SerializedStepFlowEntry[]) {
  const [graph, setGraph] = useState(() => constructNodesAndEdges({ stepGraph }));
  const onNodesChange = (changes: NodeChange<WorkflowGraphNode>[]) => {
    setGraph(currentGraph => {
      const { nodes: currentNodes, edges } = currentGraph;
      const nextNodes = applyNodeChanges(changes, currentNodes);
      const resizedNode = findMostResizedNode(changes, currentNodes);
      if (!resizedNode) return { ...currentGraph, nodes: nextNodes };
      const layout = getLayoutedElements(nextNodes, edges).nodes;
      const positionedNode = layout.find(node => node.id === resizedNode.id);
      if (!resizedNode.measured?.width || !positionedNode?.measured?.width) return { ...currentGraph, nodes: layout };
      const offsetX =
        resizedNode.position.x +
        resizedNode.measured.width / 2 -
        positionedNode.position.x -
        positionedNode.measured.width / 2;
      const offsetY = resizedNode.position.y - positionedNode.position.y;
      const anchoredNodes = layout.map(node => ({
        ...node,
        position: { x: node.position.x + offsetX, y: node.position.y + offsetY },
      }));
      return { ...currentGraph, nodes: anchoredNodes };
    });
  };
  return { ...graph, onNodesChange };
}
