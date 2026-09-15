import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { applyNodeChanges } from '@xyflow/react';
import type { NodeChange } from '@xyflow/react';
import { useState } from 'react';
import { constructNodesAndEdges } from './utils';
import type { WorkflowGraphNode } from './utils';
import { getLayoutedElements } from './workflow-graph-layout';

export function useWorkflowGraphNodes(stepGraph: SerializedStepFlowEntry[]) {
  const [graph, setGraph] = useState(() => constructNodesAndEdges({ stepGraph }));
  const onNodesChange = (changes: NodeChange<WorkflowGraphNode>[]) => {
    setGraph(currentGraph => {
      const { nodes: currentNodes, edges } = currentGraph;
      const nextNodes = applyNodeChanges(changes, currentNodes);
      const dimensionChanges = changes.filter(change => change.type === 'dimensions');
      if (!dimensionChanges.length) return { ...currentGraph, nodes: nextNodes };
      const layout = getLayoutedElements(nextNodes, edges).nodes;
      const resizedNode = currentNodes.find(node =>
        dimensionChanges.some(change => change.id === node.id && node.measured?.width && node.measured.height),
      );
      const positionedNode = layout.find(node => node.id === resizedNode?.id);
      if (!resizedNode?.measured?.width || !positionedNode?.measured?.width) return { ...currentGraph, nodes: layout };
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
