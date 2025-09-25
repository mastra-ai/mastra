import { useMastraClient } from '@/contexts/mastra-client-context';
import { GetAgentResponse, GetToolResponse, GetWorkflowResponse, MastraClient } from '@mastra/client-js';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Controls,
  MiniMap,
  Background,
  ReactFlow,
  BackgroundVariant,
  Node,
  Edge,
  XYPosition,
} from '@xyflow/react';
import { useState, useCallback, useEffect } from 'react';

export interface AgentNetworkProps {
  agent: GetAgentResponse;
}

const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];

const agentToNode = (agent: { id: string; name: string }, parentPosition: XYPosition) => {
  return {
    id: agent.name,
    data: { label: agent.name },
    position: { x: parentPosition.x + 100, y: parentPosition.y + 100 },
  };
};

const workflowToNode = (workflow: GetWorkflowResponse, parentPosition: XYPosition) => {
  return {
    id: workflow.name,
    data: { label: workflow.name },
    position: { x: parentPosition.x + 100, y: parentPosition.y + 100 },
  };
};

const toolToNode = (tool: GetToolResponse, parentPosition: XYPosition) => {
  return {
    id: tool.id,
    data: { label: tool.id },
    position: { x: parentPosition.x + 100, y: parentPosition.y + 100 },
  };
};

const prepareAgentSubGraph = async (agent: GetAgentResponse, agentNode: Node, client: MastraClient) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const tools = Object.values(agent.tools);
  const workflows = Object.values(agent.workflows);
  const agents = Object.entries(agent.agents);

  for (const tool of tools) {
    const toolNode = toolToNode(tool, agentNode.position);
    edges.push({ id: `${agentNode.id}-${toolNode.id}`, source: agentNode.id, target: toolNode.id });
    nodes.push(toolNode);
  }

  for (const workflow of workflows) {
    const workflowNode = workflowToNode(workflow, agentNode.position);
    edges.push({ id: `${agentNode.id}-${workflowNode.id}`, source: agentNode.id, target: workflowNode.id });
    nodes.push(workflowNode);
  }

  for (const [id, childAgent] of agents) {
    const childAgentNode = agentToNode(childAgent, agentNode.position);
    edges.push({ id: `${agentNode.id}-${childAgentNode.id}`, source: agentNode.id, target: childAgentNode.id });
    nodes.push(childAgentNode);

    const childAgentResponse = await client.getAgent(id).details();
    const { nodes: childNodes, edges: childEdges } = await prepareAgentSubGraph(
      childAgentResponse,
      childAgentNode,
      client,
    );
    nodes.push(...childNodes);
    edges.push(...childEdges);
  }

  return { nodes, edges };
};

export const AgentNetwork = ({ agent }: AgentNetworkProps) => {
  const client = useMastraClient();
  const [{ nodes, edges }, setNodes] = useState({ nodes: [] as Node[], edges: [] as Edge[] });

  useEffect(() => {
    const run = async () => {
      const allNodes: Node[] = [];
      const allEdges: Edge[] = [];

      const rootNode = { id: 'root', position: { x: 0, y: 0 }, data: { label: agent.name } };
      allNodes.push(rootNode);

      const { nodes, edges } = await prepareAgentSubGraph(agent, rootNode, client);

      allNodes.push(...nodes);
      allEdges.push(...edges);

      setNodes({ nodes: allNodes, edges: allEdges });
    };

    run();
  }, [agent]);

  const onNodesChange = useCallback(
    (changes: any) =>
      setNodes(nodesSnapshot => ({
        nodes: applyNodeChanges(changes, nodesSnapshot.nodes),
        edges: nodesSnapshot.edges,
      })),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView onNodesChange={onNodesChange} colorMode="dark">
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};
