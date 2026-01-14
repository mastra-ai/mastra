import Dagre from '@dagrejs/dagre';
import type {
  BuilderNode,
  BuilderEdge,
  AgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  ConditionBranch,
} from '../types';
import { createTriggerNodeData, createAgentNodeData, createToolNodeData, createConditionNodeData } from '../types';
import type {
  StorageWorkflowDefinitionType,
  DeclarativeStepDefinition,
  AgentStepDef,
  ToolStepDef,
  ConditionDef,
  VariableRef,
} from '@mastra/core/storage';

export interface DeserializeResult {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
}

const NODE_WIDTH = 274;
const NODE_HEIGHT = 100;

/**
 * Convert StorageWorkflowDefinitionType to React Flow nodes/edges
 */
export function deserializeDefinition(definition: StorageWorkflowDefinitionType): DeserializeResult {
  const nodes: BuilderNode[] = [];
  const edges: BuilderEdge[] = [];

  // Create trigger node
  const triggerNode: BuilderNode = {
    id: 'trigger',
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: createTriggerNodeData(),
  };
  nodes.push(triggerNode);

  // Create nodes for each step
  for (const [stepId, stepDef] of Object.entries(definition.steps)) {
    const node = stepDefToNode(stepId, stepDef);
    if (node) {
      nodes.push(node);
    }
  }

  // Create edges from stepGraph
  let lastNodeId = 'trigger';
  let conditionCounter = 0;

  for (const entry of definition.stepGraph) {
    switch (entry.type) {
      case 'step': {
        edges.push({
          id: `e-${lastNodeId}-${entry.step.id}`,
          source: lastNodeId,
          target: entry.step.id,
        });
        lastNodeId = entry.step.id;
        break;
      }

      case 'conditional': {
        // Create a condition node
        const conditionNodeId = `condition-${conditionCounter++}`;
        const branches: ConditionBranch[] = entry.branches.map((branch, i) => ({
          id: String(i),
          label: `Branch ${i + 1}`,
          condition: branch.condition,
        }));

        // Add default branch if present
        if (entry.default) {
          branches.push({
            id: 'default',
            label: 'Default',
            condition: null,
          });
        }

        const conditionNodeData: ConditionNodeData = {
          ...createConditionNodeData('Condition'),
          branches,
          defaultBranch: entry.default ? 'default' : undefined,
        };

        const conditionNode: BuilderNode = {
          id: conditionNodeId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: conditionNodeData,
        };
        nodes.push(conditionNode);

        // Edge from last node to condition
        edges.push({
          id: `e-${lastNodeId}-${conditionNodeId}`,
          source: lastNodeId,
          target: conditionNodeId,
        });

        // Create edges to each branch target
        for (let i = 0; i < entry.branches.length; i++) {
          const branch = entry.branches[i];
          edges.push({
            id: `e-${conditionNodeId}-${branch.stepId}-${i}`,
            source: conditionNodeId,
            target: branch.stepId,
            sourceHandle: `branch-${i}`,
            data: {
              branchId: String(i),
              label: `Branch ${i + 1}`,
            },
          });
        }

        if (entry.default) {
          edges.push({
            id: `e-${conditionNodeId}-${entry.default}-default`,
            source: conditionNodeId,
            target: entry.default,
            sourceHandle: `branch-${entry.branches.length}`,
            data: {
              branchId: 'default',
              label: 'Default',
            },
          });
        }

        // Note: With conditions, there's no single "last node"
        // This is a simplification - real implementation would need more sophisticated graph traversal
        break;
      }

      case 'parallel': {
        for (const parallelStep of entry.steps) {
          edges.push({
            id: `e-${lastNodeId}-${parallelStep.step.id}`,
            source: lastNodeId,
            target: parallelStep.step.id,
          });
        }
        // After parallel, we'd need to track multiple "last nodes"
        // For simplicity, we don't update lastNodeId here
        break;
      }

      // Handle other entry types as needed
      case 'sleep':
      case 'sleepUntil':
      case 'loop':
      case 'foreach':
      case 'map':
        // These types are not yet fully supported in the builder
        break;
    }
  }

  // Apply dagre layout
  const layoutedNodes = applyDagreLayout(nodes, edges);

  return {
    nodes: layoutedNodes,
    edges,
  };
}

/**
 * Convert a step definition to a React Flow node
 */
function stepDefToNode(stepId: string, stepDef: DeclarativeStepDefinition): BuilderNode | null {
  switch (stepDef.type) {
    case 'agent': {
      const agentDef = stepDef as AgentStepDef;
      // Use agent ID as label (more readable than UUID), fallback to generic label
      const label = agentDef.agentId || 'Agent Step';
      const agentData: AgentNodeData = {
        ...createAgentNodeData(label),
        agentId: agentDef.agentId,
        prompt: agentDef.input.prompt as VariableRef,
        instructions: typeof agentDef.input.instructions === 'string' ? agentDef.input.instructions : undefined,
        structuredOutput: agentDef.structuredOutput,
      };

      return {
        id: stepId,
        type: 'agent',
        position: { x: 0, y: 0 },
        data: agentData,
      };
    }

    case 'tool': {
      const toolDef = stepDef as ToolStepDef;
      // Use tool ID as label (more readable than UUID), fallback to generic label
      const label = toolDef.toolId || 'Tool Step';
      const toolData: ToolNodeData = {
        ...createToolNodeData(label),
        toolId: toolDef.toolId,
        input: toolDef.input ?? {},
      };

      return {
        id: stepId,
        type: 'tool',
        position: { x: 0, y: 0 },
        data: toolData,
      };
    }

    case 'workflow':
    case 'transform':
    case 'suspend':
      // These step types are not yet fully supported in the builder
      return null;

    default:
      return null;
  }
}

/**
 * Apply dagre layout to position nodes in a top-to-bottom graph
 */
function applyDagreLayout(nodes: BuilderNode[], edges: BuilderEdge[]): BuilderNode[] {
  if (nodes.length === 0) return nodes;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });

  // Add nodes to graph
  for (const node of nodes) {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Add edges to graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // Run layout
  Dagre.layout(g);

  // Apply positions
  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}
