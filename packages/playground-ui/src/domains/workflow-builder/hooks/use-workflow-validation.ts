import { useMemo } from 'react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
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
  AgentNetworkNodeData,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  nodeId: string | null;
  nodeLabel?: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  all: ValidationIssue[];
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateWorkflowStructure(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  inputSchema: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for trigger node
  const triggerNode = nodes.find(n => n.data.type === 'trigger');
  if (!triggerNode) {
    issues.push({
      id: 'no-trigger',
      nodeId: null,
      severity: 'error',
      message: 'Workflow must have a trigger node',
    });
  }

  // Check for at least one step after trigger
  const stepNodes = nodes.filter(n => n.data.type !== 'trigger');
  if (stepNodes.length === 0) {
    issues.push({
      id: 'no-steps',
      nodeId: null,
      severity: 'warning',
      message: 'Workflow has no steps - add agent, tool, or condition nodes',
    });
  }

  // Check for disconnected nodes (nodes with no incoming or outgoing edges, except trigger)
  for (const node of nodes) {
    if (node.data.type === 'trigger') continue;

    const hasIncoming = edges.some(e => e.target === node.id);
    const hasOutgoing = edges.some(e => e.source === node.id);

    if (!hasIncoming) {
      issues.push({
        id: `disconnected-no-input-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.data.label,
        severity: 'error',
        message: `"${node.data.label}" has no incoming connection - connect it to trigger or another step`,
      });
    }
  }

  // Check trigger has at least one outgoing edge
  if (triggerNode) {
    const triggerHasOutgoing = edges.some(e => e.source === triggerNode.id);
    if (!triggerHasOutgoing && stepNodes.length > 0) {
      issues.push({
        id: 'trigger-not-connected',
        nodeId: triggerNode.id,
        nodeLabel: triggerNode.data.label,
        severity: 'error',
        message: 'Trigger is not connected to any step',
      });
    }
  }

  // Check input schema has fields
  const schemaProperties = (inputSchema as { properties?: Record<string, unknown> }).properties;
  if (!schemaProperties || Object.keys(schemaProperties).length === 0) {
    issues.push({
      id: 'no-input-schema',
      nodeId: triggerNode?.id || null,
      nodeLabel: triggerNode?.data.label,
      severity: 'warning',
      message: 'Workflow has no input schema defined - consider adding input fields',
    });
  }

  return issues;
}

function validateAgentNode(node: BuilderNode, predecessorIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as AgentNodeData;

  // Check agent is selected
  if (!data.agentId) {
    issues.push({
      id: `agent-not-selected-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no agent selected`,
      field: 'agentId',
    });
  }

  // Check prompt source is set
  if (!data.prompt?.$ref) {
    issues.push({
      id: `agent-no-prompt-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no prompt source configured`,
      field: 'prompt',
    });
  } else {
    // Validate the prompt reference points to a valid source
    const ref = data.prompt.$ref;
    if (ref.startsWith('steps.')) {
      const stepId = ref.split('.')[1];
      if (stepId && !predecessorIds.has(stepId)) {
        issues.push({
          id: `agent-invalid-prompt-ref-${node.id}`,
          nodeId: node.id,
          nodeLabel: data.label,
          severity: 'error',
          message: `"${data.label}" references step "${stepId}" which is not a predecessor`,
          field: 'prompt',
        });
      }
    }
  }

  return issues;
}

function validateToolNode(
  node: BuilderNode,
  predecessorIds: Set<string>,
  toolInputSchemas: Map<string, { required: string[]; all: string[] }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ToolNodeData;

  // Check tool is selected
  if (!data.toolId) {
    issues.push({
      id: `tool-not-selected-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no tool selected`,
      field: 'toolId',
    });
    return issues;
  }

  // Check required inputs are mapped
  const toolSchema = toolInputSchemas.get(data.toolId);
  if (toolSchema) {
    for (const requiredField of toolSchema.required) {
      const mapping = data.input[requiredField];
      if (!mapping) {
        issues.push({
          id: `tool-missing-required-${node.id}-${requiredField}`,
          nodeId: node.id,
          nodeLabel: data.label,
          severity: 'error',
          message: `"${data.label}" is missing required input "${requiredField}"`,
          field: `input.${requiredField}`,
        });
      } else if ('$ref' in mapping && !mapping.$ref) {
        issues.push({
          id: `tool-empty-required-${node.id}-${requiredField}`,
          nodeId: node.id,
          nodeLabel: data.label,
          severity: 'error',
          message: `"${data.label}" has empty mapping for required input "${requiredField}"`,
          field: `input.${requiredField}`,
        });
      }
    }
  }

  // Validate references point to valid predecessors
  for (const [key, value] of Object.entries(data.input)) {
    if ('$ref' in value && value.$ref) {
      const ref = value.$ref;
      if (ref.startsWith('steps.')) {
        const stepId = ref.split('.')[1];
        if (stepId && !predecessorIds.has(stepId)) {
          issues.push({
            id: `tool-invalid-ref-${node.id}-${key}`,
            nodeId: node.id,
            nodeLabel: data.label,
            severity: 'error',
            message: `"${data.label}" input "${key}" references step "${stepId}" which is not a predecessor`,
            field: `input.${key}`,
          });
        }
      }
    }
  }

  return issues;
}

function validateConditionNode(node: BuilderNode, edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ConditionNodeData;

  // Check each branch has a condition defined
  for (const branch of data.branches) {
    if (!branch.condition) {
      issues.push({
        id: `condition-no-condition-${node.id}-${branch.id}`,
        nodeId: node.id,
        nodeLabel: data.label,
        severity: 'warning',
        message: `"${data.label}" branch "${branch.label}" has no condition defined`,
        field: `branches.${branch.id}`,
      });
    }
  }

  // Check each branch has an outgoing edge
  const outgoingEdges = edges.filter(e => e.source === node.id);
  for (const branch of data.branches) {
    const hasBranchEdge = outgoingEdges.some(e => e.sourceHandle === branch.id);
    if (!hasBranchEdge) {
      issues.push({
        id: `condition-no-edge-${node.id}-${branch.id}`,
        nodeId: node.id,
        nodeLabel: data.label,
        severity: 'warning',
        message: `"${data.label}" branch "${branch.label}" is not connected to any step`,
        field: `branches.${branch.id}`,
      });
    }
  }

  return issues;
}

function validateParallelNode(node: BuilderNode, edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ParallelNodeData;

  // Check at least 2 branches
  if (data.branches.length < 2) {
    issues.push({
      id: `parallel-insufficient-branches-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" needs at least 2 branches for parallel execution`,
      field: 'branches',
    });
  }

  // Check each branch has an outgoing edge
  const outgoingEdges = edges.filter(e => e.source === node.id);
  for (const branch of data.branches) {
    const hasBranchEdge = outgoingEdges.some(e => e.sourceHandle === branch.id);
    if (!hasBranchEdge) {
      issues.push({
        id: `parallel-no-edge-${node.id}-${branch.id}`,
        nodeId: node.id,
        nodeLabel: data.label,
        severity: 'warning',
        message: `"${data.label}" branch "${branch.label}" is not connected to any step`,
        field: `branches.${branch.id}`,
      });
    }
  }

  return issues;
}

function validateLoopNode(node: BuilderNode, edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as LoopNodeData;

  // Check condition is defined
  if (!data.condition) {
    issues.push({
      id: `loop-no-condition-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no loop condition defined`,
      field: 'condition',
    });
  }

  // Check loop has a body (outgoing edge)
  const outgoingEdges = edges.filter(e => e.source === node.id);
  const hasBodyEdge = outgoingEdges.some(e => e.sourceHandle === 'loop-body' || !e.sourceHandle);
  if (!hasBodyEdge) {
    issues.push({
      id: `loop-no-body-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no loop body - connect a step to execute in the loop`,
      field: 'body',
    });
  }

  return issues;
}

function validateForeachNode(node: BuilderNode, edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ForeachNodeData;

  // Check collection is defined
  if (!data.collection?.$ref) {
    issues.push({
      id: `foreach-no-collection-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no collection reference - select an array to iterate over`,
      field: 'collection',
    });
  }

  // Check foreach has a body (outgoing edge)
  const outgoingEdges = edges.filter(e => e.source === node.id);
  const hasBodyEdge = outgoingEdges.some(e => e.sourceHandle === 'foreach-body' || !e.sourceHandle);
  if (!hasBodyEdge) {
    issues.push({
      id: `foreach-no-body-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no body - connect a step to execute for each item`,
      field: 'body',
    });
  }

  return issues;
}

function validateTransformNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as TransformNodeData;

  // Check at least one output mapping
  if (Object.keys(data.output).length === 0) {
    issues.push({
      id: `transform-no-output-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'warning',
      message: `"${data.label}" has no output mappings defined`,
      field: 'output',
    });
  }

  return issues;
}

function validateSuspendNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as SuspendNodeData;

  // Check resume schema has properties
  const schemaProperties = (data.resumeSchema as { properties?: Record<string, unknown> }).properties;
  if (!schemaProperties || Object.keys(schemaProperties).length === 0) {
    issues.push({
      id: `suspend-no-resume-schema-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'warning',
      message: `"${data.label}" has no resume schema fields - add fields users need to provide`,
      field: 'resumeSchema',
    });
  }

  return issues;
}

function validateWorkflowNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as WorkflowNodeData;

  // Check workflow is selected
  if (!data.workflowId) {
    issues.push({
      id: `workflow-not-selected-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no workflow selected`,
      field: 'workflowId',
    });
  }

  return issues;
}

function validateSleepNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as SleepNodeData;

  if (data.sleepType === 'duration') {
    if (data.duration === undefined || data.duration <= 0) {
      issues.push({
        id: `sleep-invalid-duration-${node.id}`,
        nodeId: node.id,
        nodeLabel: data.label,
        severity: 'error',
        message: `"${data.label}" has no valid duration set`,
        field: 'duration',
      });
    }
  } else if (data.sleepType === 'timestamp') {
    if (!data.timestamp) {
      issues.push({
        id: `sleep-no-timestamp-${node.id}`,
        nodeId: node.id,
        nodeLabel: data.label,
        severity: 'error',
        message: `"${data.label}" has no timestamp configured`,
        field: 'timestamp',
      });
    }
  }

  return issues;
}

function validateAgentNetworkNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as AgentNetworkNodeData;

  // Check network is selected
  if (!data.networkId) {
    issues.push({
      id: `agent-network-not-selected-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no agent network selected`,
      field: 'networkId',
    });
  }

  // Check at least one agent in network
  if (data.agents.length === 0) {
    issues.push({
      id: `agent-network-no-agents-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'warning',
      message: `"${data.label}" has no agents in the network`,
      field: 'agents',
    });
  }

  // Check prompt source is set
  if (!data.prompt?.$ref) {
    issues.push({
      id: `agent-network-no-prompt-${node.id}`,
      nodeId: node.id,
      nodeLabel: data.label,
      severity: 'error',
      message: `"${data.label}" has no prompt source configured`,
      field: 'prompt',
    });
  }

  return issues;
}

/**
 * Detect cycles in the workflow graph
 * Note: Loop nodes are expected to have cycles, so we exclude those
 */
function detectCycles(nodes: BuilderNode[], edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  }

  // Get all loop node IDs (they're allowed to have back-edges)
  const loopNodeIds = new Set(nodes.filter(n => n.data.type === 'loop' || n.data.type === 'foreach').map(n => n.id));

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes: string[] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(path.join(' -> '));

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      // Skip loop body edges (they're expected to have cycles)
      const edge = edges.find(e => e.source === nodeId && e.target === neighbor);
      if (edge?.sourceHandle === 'loop-body' || edge?.sourceHandle === 'foreach-body') {
        continue;
      }

      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path, neighbor])) {
          return true;
        }
      } else if (path.includes(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor);
        cycleNodes.push(...cycle);
        return true;
      }
    }

    return false;
  }

  // Start DFS from trigger node
  const triggerNode = nodes.find(n => n.data.type === 'trigger');
  if (triggerNode) {
    dfs(triggerNode.id, [triggerNode.id]);
  }

  // Report any detected cycles
  if (cycleNodes.length > 0) {
    const uniqueCycleNodes = [...new Set(cycleNodes)].filter(id => !loopNodeIds.has(id));
    if (uniqueCycleNodes.length > 0) {
      const nodeLabels = uniqueCycleNodes.map(id => nodes.find(n => n.id === id)?.data.label || id).join(', ');

      issues.push({
        id: 'cycle-detected',
        nodeId: uniqueCycleNodes[0],
        severity: 'error',
        message: `Workflow contains a cycle involving: ${nodeLabels}`,
      });
    }
  }

  return issues;
}

function getPredecessorIds(nodeId: string, edges: BuilderEdge[]): Set<string> {
  const predecessors = new Set<string>();
  const visited = new Set<string>();

  const reverseAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) {
      reverseAdj.set(edge.target, []);
    }
    reverseAdj.get(edge.target)!.push(edge.source);
  }

  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const sources = reverseAdj.get(current) || [];
    for (const source of sources) {
      if (source !== 'trigger') {
        predecessors.add(source);
      }
      queue.push(source);
    }
  }

  return predecessors;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useWorkflowValidation(
  toolInputSchemas?: Map<string, { required: string[]; all: string[] }>,
): ValidationResult {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  return useMemo(() => {
    const allIssues: ValidationIssue[] = [];

    // Validate workflow structure
    allIssues.push(...validateWorkflowStructure(nodes, edges, inputSchema));

    // Check for cycles
    allIssues.push(...detectCycles(nodes, edges));

    // Validate each node
    for (const node of nodes) {
      if (node.data.type === 'trigger') continue;

      const predecessorIds = getPredecessorIds(node.id, edges);

      switch (node.data.type) {
        case 'agent':
          allIssues.push(...validateAgentNode(node, predecessorIds));
          break;
        case 'tool':
          allIssues.push(...validateToolNode(node, predecessorIds, toolInputSchemas || new Map()));
          break;
        case 'condition':
          allIssues.push(...validateConditionNode(node, edges));
          break;
        case 'parallel':
          allIssues.push(...validateParallelNode(node, edges));
          break;
        case 'loop':
          allIssues.push(...validateLoopNode(node, edges));
          break;
        case 'foreach':
          allIssues.push(...validateForeachNode(node, edges));
          break;
        case 'transform':
          allIssues.push(...validateTransformNode(node));
          break;
        case 'suspend':
          allIssues.push(...validateSuspendNode(node));
          break;
        case 'workflow':
          allIssues.push(...validateWorkflowNode(node));
          break;
        case 'sleep':
          allIssues.push(...validateSleepNode(node));
          break;
        case 'agent-network':
          allIssues.push(...validateAgentNetworkNode(node));
          break;
      }
    }

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');
    const infos = allIssues.filter(i => i.severity === 'info');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      infos,
      all: allIssues,
    };
  }, [nodes, edges, inputSchema, toolInputSchemas]);
}
