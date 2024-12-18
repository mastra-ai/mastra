import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback } from 'react';

import { WorkflowDefaultNode } from './workflow-node';

const initialNodes = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    type: 'default-node',
    data: { label: 'lat one', description: 'lat one description' },
  },
  {
    id: '2',
    position: { x: 0, y: 100 },
    type: 'default-node',
    data: { label: 'lat two', description: 'lat two description' },
  },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

function WorkflowGraph() {
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params: any) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  const nodeTypes = {
    'default-node': WorkflowDefaultNode,
  };

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        // onEdgesChange={onEdgesChange}
        // onConnect={onConnect}
        fitView
      >
        <Controls />
        <MiniMap pannable zoomable maskColor="#121212" bgColor="#171717" nodeColor="#2c2c2c" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export default WorkflowGraph;
