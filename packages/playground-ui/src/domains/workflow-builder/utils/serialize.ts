import type { BuilderNode, BuilderEdge, AgentNodeData, ToolNodeData, ConditionNodeData } from '../types';
import type {
  StorageWorkflowDefinitionType,
  DeclarativeStepDefinition,
  DefinitionStepFlowEntry,
  AgentStepDef,
  ToolStepDef,
} from '@mastra/core/storage';

export interface SerializeOptions {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface SerializedGraph {
  stepGraph: DefinitionStepFlowEntry[];
  steps: Record<string, DeclarativeStepDefinition>;
}

/**
 * Convert React Flow nodes/edges to stepGraph and steps
 * This is the minimal serialization needed for saving - the caller provides metadata
 */
export function serializeGraph(nodes: BuilderNode[], edges: BuilderEdge[]): SerializedGraph {
  // Build steps object from non-trigger nodes
  const steps: Record<string, DeclarativeStepDefinition> = {};

  for (const node of nodes) {
    if (node.data.type === 'trigger') continue;
    if (node.data.type === 'condition') continue; // Conditions are handled in stepGraph

    const stepDef = nodeToStepDef(node);
    if (stepDef) {
      steps[node.id] = stepDef;
    }
  }

  // Build stepGraph by traversing from trigger
  const stepGraph = buildStepGraph(nodes, edges);

  return { stepGraph, steps };
}

/**
 * Convert React Flow nodes/edges to full StorageWorkflowDefinitionType
 */
export function serializeGraphFull(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  options: SerializeOptions,
): Omit<StorageWorkflowDefinitionType, 'createdAt' | 'updatedAt'> {
  const { stepGraph, steps } = serializeGraph(nodes, edges);

  return {
    id: options.id,
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema ?? {},
    outputSchema: options.outputSchema ?? {},
    stepGraph,
    steps,
  };
}

/**
 * Convert a node to its step definition
 */
function nodeToStepDef(node: BuilderNode): DeclarativeStepDefinition | null {
  switch (node.data.type) {
    case 'agent': {
      const data = node.data as AgentNodeData;
      if (!data.agentId) return null;

      const stepDef: AgentStepDef = {
        type: 'agent',
        agentId: data.agentId,
        input: {
          prompt: data.prompt ?? { $ref: 'input.prompt' },
        },
      };

      if (data.instructions) {
        stepDef.input.instructions = data.instructions;
      }

      if (data.structuredOutput) {
        stepDef.structuredOutput = data.structuredOutput;
      }

      return stepDef;
    }

    case 'tool': {
      const data = node.data as ToolNodeData;
      if (!data.toolId) return null;

      const stepDef: ToolStepDef = {
        type: 'tool',
        toolId: data.toolId,
        input: data.input,
      };

      return stepDef;
    }

    default:
      return null;
  }
}

/**
 * Build stepGraph by traversing edges from trigger node
 */
function buildStepGraph(nodes: BuilderNode[], edges: BuilderEdge[]): DefinitionStepFlowEntry[] {
  const stepGraph: DefinitionStepFlowEntry[] = [];

  // Find trigger node
  const triggerNode = nodes.find(n => n.data.type === 'trigger');
  if (!triggerNode) return stepGraph;

  // Build adjacency map (source -> edges)
  const adjacency = new Map<string, BuilderEdge[]>();
  for (const edge of edges) {
    const existing = adjacency.get(edge.source) ?? [];
    existing.push(edge);
    adjacency.set(edge.source, existing);
  }

  // Create a node map for quick lookup
  const nodeMap = new Map<string, BuilderNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Track visited nodes to avoid cycles
  const visited = new Set<string>();

  /**
   * Traverse the graph from a given node and add entries to stepGraph
   */
  function traverse(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const outgoingEdges = adjacency.get(nodeId) ?? [];
    if (outgoingEdges.length === 0) return;

    const node = nodeMap.get(nodeId);

    // Handle condition nodes specially
    if (node?.data.type === 'condition') {
      const conditionData = node.data as ConditionNodeData;
      const branches: Array<{
        condition: NonNullable<(typeof conditionData.branches)[0]['condition']>;
        stepId: string;
      }> = [];
      let defaultStepId: string | undefined;

      for (const edge of outgoingEdges) {
        // Determine which branch this edge corresponds to
        const branchId = edge.data?.branchId ?? edge.sourceHandle?.replace('branch-', '');

        // Check if this is the default branch
        if (branchId === 'default' || branchId === conditionData.defaultBranch) {
          defaultStepId = edge.target;
        } else {
          // Find the matching branch by ID
          const branch = conditionData.branches.find(b => b.id === branchId);
          if (branch?.condition) {
            branches.push({
              condition: branch.condition,
              stepId: edge.target,
            });
          } else {
            // Try matching by index
            const branchIndex = parseInt(branchId ?? '0', 10);
            if (!isNaN(branchIndex) && branchIndex < conditionData.branches.length) {
              const indexedBranch = conditionData.branches[branchIndex];
              if (indexedBranch?.condition) {
                branches.push({
                  condition: indexedBranch.condition,
                  stepId: edge.target,
                });
              }
            }
          }
        }
      }

      if (branches.length > 0) {
        stepGraph.push({
          type: 'conditional',
          branches,
          default: defaultStepId,
        });
      }

      // Continue traversal for each target
      for (const edge of outgoingEdges) {
        traverse(edge.target);
      }
    } else {
      // Regular sequential steps
      for (const edge of outgoingEdges) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode && targetNode.data.type !== 'trigger') {
          // Only add step entries for non-condition nodes
          if (targetNode.data.type !== 'condition') {
            stepGraph.push({
              type: 'step',
              step: {
                id: edge.target,
                description: targetNode.data.description,
              },
            });
          }
          traverse(edge.target);
        }
      }
    }
  }

  traverse(triggerNode.id);

  return stepGraph;
}
