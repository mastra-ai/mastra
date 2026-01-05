import { Edge } from '@xyflow/react';
import { WorkflowNode } from '../types';
import Dagre from '@dagrejs/dagre';

const DEFAULT_NODE_WIDTH = 320;
const DEFAULT_NODE_HEIGHT = DEFAULT_NODE_WIDTH / 2;

export const positionWorkflowNodes = (nodes: WorkflowNode[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 60 });

  nodes.forEach(node => {
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
      height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
    });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const newNodes = nodes.map(node => {
    const nodeWithPosition = g.node(node.id);

    const newNode: WorkflowNode = {
      ...node,

      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};
