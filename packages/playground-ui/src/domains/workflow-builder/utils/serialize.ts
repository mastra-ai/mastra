import type {
  BuilderNode,
  BuilderEdge,
  AgentNodeData,
  ToolNodeData,
  ConditionNodeData,
  ParallelNodeData,
  LoopNodeData,
  ForeachNodeData,
  TransformNodeData,
  SuspendNodeData,
  WorkflowNodeData,
  SleepNodeData,
} from '../types';
import type {
  StorageWorkflowDefinitionType,
  DeclarativeStepDefinition,
  DefinitionStepFlowEntry,
  AgentStepDef,
  ToolStepDef,
  WorkflowStepDef,
  TransformStepDef,
  SuspendStepDef,
} from '@mastra/core/storage';

export interface SerializeOptions {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
}

export interface SerializedGraph {
  stepGraph: DefinitionStepFlowEntry[];
  steps: Record<string, DeclarativeStepDefinition>;
  warnings: string[];
}

/**
 * Convert React Flow nodes/edges to stepGraph and steps
 * This is the minimal serialization needed for saving - the caller provides metadata
 */
export function serializeGraph(nodes: BuilderNode[], edges: BuilderEdge[]): SerializedGraph {
  // Build steps object from non-trigger nodes
  const steps: Record<string, DeclarativeStepDefinition> = {};
  const warnings: string[] = [];

  for (const node of nodes) {
    // Skip types that don't have step definitions (handled in stepGraph only)
    if (node.data.type === 'trigger') continue;
    if (node.data.type === 'condition') continue;
    if (node.data.type === 'parallel') continue;
    if (node.data.type === 'loop') continue;
    if (node.data.type === 'foreach') continue;
    if (node.data.type === 'sleep') continue;
    if (node.data.type === 'agent-network') {
      // Not yet supported in core - collect warning
      warnings.push(
        `Agent network node "${node.data.label || node.id}" was skipped: agent-network is not yet supported`,
      );
      continue;
    }

    const stepDef = nodeToStepDef(node);
    if (stepDef) {
      steps[node.id] = stepDef;
    } else {
      // Node type exists but failed to serialize (e.g., missing required fields)
      warnings.push(
        `Node "${node.data.label || node.id}" (${node.data.type}) was skipped: missing required configuration`,
      );
    }
  }

  // Build stepGraph by traversing from trigger
  const stepGraph = buildStepGraph(nodes, edges, warnings);

  return { stepGraph, steps, warnings };
}

export interface SerializedGraphFull {
  definition: Omit<StorageWorkflowDefinitionType, 'createdAt' | 'updatedAt'>;
  warnings: string[];
}

/**
 * Convert React Flow nodes/edges to full StorageWorkflowDefinitionType
 */
export function serializeGraphFull(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  options: SerializeOptions,
): SerializedGraphFull {
  const { stepGraph, steps, warnings } = serializeGraph(nodes, edges);

  return {
    definition: {
      id: options.id,
      name: options.name,
      description: options.description,
      inputSchema: options.inputSchema ?? {},
      outputSchema: options.outputSchema ?? {},
      stateSchema: options.stateSchema,
      stepGraph,
      steps,
    },
    warnings,
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

    case 'workflow': {
      const data = node.data as WorkflowNodeData;
      if (!data.workflowId) return null;

      const stepDef: WorkflowStepDef = {
        type: 'workflow',
        workflowId: data.workflowId,
        input: data.input,
      };

      return stepDef;
    }

    case 'transform': {
      const data = node.data as TransformNodeData;

      const stepDef: TransformStepDef = {
        type: 'transform',
        output: data.output,
        outputSchema: data.outputSchema,
      };

      return stepDef;
    }

    case 'suspend': {
      const data = node.data as SuspendNodeData;

      const stepDef: SuspendStepDef = {
        type: 'suspend',
        resumeSchema: data.resumeSchema,
        payload: data.payload,
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
function buildStepGraph(nodes: BuilderNode[], edges: BuilderEdge[], warnings: string[]): DefinitionStepFlowEntry[] {
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
   * Add a step graph entry for a node
   */
  function addStepGraphEntry(node: BuilderNode): void {
    switch (node.data.type) {
      case 'sleep': {
        const data = node.data as SleepNodeData;
        if (data.sleepType === 'duration' && data.duration !== undefined) {
          stepGraph.push({
            type: 'sleep',
            id: node.id,
            duration: data.duration,
          });
        } else if (data.sleepType === 'timestamp' && data.timestamp !== undefined) {
          stepGraph.push({
            type: 'sleepUntil',
            id: node.id,
            timestamp: data.timestamp,
          });
        }
        break;
      }

      case 'loop': {
        const data = node.data as LoopNodeData;
        // Get the step inside the loop (first outgoing edge target)
        const loopEdges = adjacency.get(node.id) ?? [];
        const loopBodyEdge = loopEdges.find(e => e.sourceHandle === 'loop-body' || !e.sourceHandle);
        if (loopBodyEdge && data.condition) {
          stepGraph.push({
            type: 'loop',
            stepId: loopBodyEdge.target,
            condition: data.condition,
            loopType: data.loopType,
          });
        }
        break;
      }

      case 'foreach': {
        const data = node.data as ForeachNodeData;
        // Get the step inside the foreach (first outgoing edge target)
        const foreachEdges = adjacency.get(node.id) ?? [];
        const foreachBodyEdge = foreachEdges.find(e => e.sourceHandle === 'foreach-body' || !e.sourceHandle);
        if (foreachBodyEdge && data.collection) {
          stepGraph.push({
            type: 'foreach',
            stepId: foreachBodyEdge.target,
            collection: data.collection,
            concurrency: data.concurrency,
          });
        }
        break;
      }

      case 'parallel': {
        const data = node.data as ParallelNodeData;
        const parallelEdges = adjacency.get(node.id) ?? [];
        const parallelSteps: Array<{ type: 'step'; step: { id: string } }> = [];

        for (const edge of parallelEdges) {
          // Match edges to branches by sourceHandle
          const branchId = edge.sourceHandle?.replace('branch-', '');
          if (branchId && data.branches.some(b => b.id === branchId)) {
            parallelSteps.push({
              type: 'step',
              step: { id: edge.target },
            });
          }
        }

        if (parallelSteps.length > 0) {
          stepGraph.push({
            type: 'parallel',
            steps: parallelSteps,
          });
        }
        break;
      }

      case 'condition': {
        const data = node.data as ConditionNodeData;
        const conditionEdges = adjacency.get(node.id) ?? [];
        const branches: Array<{
          condition: NonNullable<(typeof data.branches)[0]['condition']>;
          stepId: string;
        }> = [];
        let defaultStepId: string | undefined;

        for (const edge of conditionEdges) {
          const branchId = edge.data?.branchId ?? edge.sourceHandle?.replace('branch-', '');

          if (branchId === 'default' || branchId === data.defaultBranch) {
            defaultStepId = edge.target;
          } else {
            // Find branch by ID - branches should have UUID-based IDs
            const branch = data.branches.find(b => b.id === branchId);
            if (branch?.condition) {
              branches.push({
                condition: branch.condition,
                stepId: edge.target,
              });
            } else if (branchId) {
              // Branch ID not found - this could indicate data inconsistency
              warnings.push(`Condition node "${data.label || node.id}": could not find branch with ID "${branchId}"`);
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
        break;
      }

      case 'transform': {
        // Transform nodes also add a map entry to stepGraph for inline transforms
        const data = node.data as TransformNodeData;
        if (Object.keys(data.output).length > 0) {
          // Regular step entry (the step definition is in steps object)
          stepGraph.push({
            type: 'step',
            step: {
              id: node.id,
              description: data.description,
            },
          });
        } else {
          warnings.push(`Transform node "${data.label || node.id}" was skipped: output mapping is empty`);
        }
        break;
      }

      default: {
        // Regular step entry
        stepGraph.push({
          type: 'step',
          step: {
            id: node.id,
            description: node.data.description,
          },
        });
        break;
      }
    }
  }

  /**
   * Traverse the graph from a given node and add entries to stepGraph
   */
  function traverse(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    const outgoingEdges = adjacency.get(nodeId) ?? [];

    // Skip trigger node entry but process its children
    if (node?.data.type === 'trigger') {
      for (const edge of outgoingEdges) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) {
          addStepGraphEntry(targetNode);
          traverse(edge.target);
        }
      }
      return;
    }

    // Handle special flow control nodes
    if (node?.data.type === 'condition') {
      // For condition nodes, we already added the entry when we visited them
      // Now traverse all branches
      for (const edge of outgoingEdges) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) {
          addStepGraphEntry(targetNode);
          traverse(edge.target);
        }
      }
      return;
    }

    if (node?.data.type === 'parallel') {
      // For parallel nodes, traverse all parallel branches
      // The parallel entry was already added
      for (const edge of outgoingEdges) {
        traverse(edge.target);
      }
      return;
    }

    if (node?.data.type === 'loop' || node?.data.type === 'foreach') {
      // For loop/foreach, traverse the body and the continuation
      for (const edge of outgoingEdges) {
        traverse(edge.target);
      }
      return;
    }

    // Regular sequential traversal
    for (const edge of outgoingEdges) {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && targetNode.data.type !== 'trigger') {
        addStepGraphEntry(targetNode);
        traverse(edge.target);
      }
    }
  }

  traverse(triggerNode.id);

  return stepGraph;
}
