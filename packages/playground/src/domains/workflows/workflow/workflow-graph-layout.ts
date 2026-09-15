import Dagre from '@dagrejs/dagre';
import { WORKFLOW_BOUNDARY_NODE_TYPE } from '@mastra/playground-ui/components/Workflow';
import type { WorkflowGraphNode, WorkflowGraphEdge } from './utils';

const getNodeSize = (node: WorkflowGraphNode): { width: number; height: number } => {
  if (node.type === WORKFLOW_BOUNDARY_NODE_TYPE) {
    return {
      width: node.measured?.width ?? 56,
      height: node.measured?.height ?? 56,
    };
  }

  return {
    width: node.measured?.width ?? 274,
    height: node.measured?.height ?? (node?.data?.isLarge ? 260 : 100),
  };
};

export const getLayoutedElements = (nodes: WorkflowGraphNode[], edges: WorkflowGraphEdge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 84, nodesep: 64 });

  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  nodes.forEach(node =>
    g.setNode(node.id, {
      ...node,
      ...getNodeSize(node),
    }),
  );

  Dagre.layout(g);

  const fullWidth = g.graph()?.width ? g.graph().width! / 2 : 0;
  const fullHeight = g.graph()?.height ? g.graph().height! / 2 : 0;

  return {
    nodes: nodes.map(node => {
      const position = g.node(node.id);
      const { width, height } = getNodeSize(node);
      const positionX = position.x - width / 2;
      const positionY = position.y - height / 2;
      return { ...node, position: { x: positionX, y: positionY } };
    }),
    edges,
    fullWidth,
    fullHeight,
  };
};
