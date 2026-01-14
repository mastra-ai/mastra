import type {
  BuilderNode,
  BuilderEdge,
  BuilderNodeType,
  TriggerNodeData,
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
// Validation Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  nodeId: string;
  field?: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ============================================================================
// Node-Specific Validators
// ============================================================================

function validateTriggerNode(node: BuilderNode, allNodes: BuilderNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as TriggerNodeData;

  // Check for multiple triggers
  const triggerCount = allNodes.filter(n => n.data.type === 'trigger').length;
  if (triggerCount > 1) {
    issues.push({
      nodeId: node.id,
      severity: 'error',
      message: 'Only one trigger node is allowed per workflow',
      suggestion: 'Remove extra trigger nodes',
    });
  }

  // Trigger should have no incoming edges (handled in graph validation)

  return issues;
}

function validateAgentNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as AgentNodeData;

  if (!data.agentId) {
    issues.push({
      nodeId: node.id,
      field: 'agentId',
      severity: 'error',
      message: 'Agent is required',
      suggestion: 'Select an agent from the dropdown',
    });
  }

  if (!data.prompt) {
    issues.push({
      nodeId: node.id,
      field: 'prompt',
      severity: 'warning',
      message: 'No prompt source configured',
      suggestion: 'Configure where the agent prompt comes from',
    });
  }

  return issues;
}

function validateToolNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ToolNodeData;

  if (!data.toolId) {
    issues.push({
      nodeId: node.id,
      field: 'toolId',
      severity: 'error',
      message: 'Tool is required',
      suggestion: 'Select a tool from the dropdown',
    });
  }

  return issues;
}

function validateConditionNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ConditionNodeData;

  if (!data.branches || data.branches.length < 1) {
    issues.push({
      nodeId: node.id,
      field: 'branches',
      severity: 'error',
      message: 'At least one branch is required',
      suggestion: 'Add at least one condition branch',
    });
  }

  // Check if any branches have conditions configured
  const configuredBranches = data.branches?.filter(b => b.condition) || [];
  if (configuredBranches.length === 0) {
    issues.push({
      nodeId: node.id,
      field: 'branches',
      severity: 'warning',
      message: 'No branch conditions configured',
      suggestion: 'Configure conditions for your branches',
    });
  }

  return issues;
}

function validateParallelNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ParallelNodeData;

  if (!data.branches || data.branches.length < 2) {
    issues.push({
      nodeId: node.id,
      field: 'branches',
      severity: 'error',
      message: 'At least 2 branches are required for parallel execution',
      suggestion: 'Add more branches or use a different node type',
    });
  }

  return issues;
}

function validateLoopNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as LoopNodeData;

  if (!data.condition) {
    issues.push({
      nodeId: node.id,
      field: 'condition',
      severity: 'error',
      message: 'Loop condition is required',
      suggestion: 'Configure when the loop should continue or stop',
    });
  }

  if (data.maxIterations && data.maxIterations <= 0) {
    issues.push({
      nodeId: node.id,
      field: 'maxIterations',
      severity: 'warning',
      message: 'Max iterations should be greater than 0',
      suggestion: 'Set a positive max iteration limit',
    });
  }

  return issues;
}

function validateForeachNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as ForeachNodeData;

  if (!data.collection) {
    issues.push({
      nodeId: node.id,
      field: 'collection',
      severity: 'error',
      message: 'Collection to iterate is required',
      suggestion: 'Select a data source to iterate over',
    });
  }

  if (!data.itemVariable) {
    issues.push({
      nodeId: node.id,
      field: 'itemVariable',
      severity: 'warning',
      message: 'Item variable name not set',
      suggestion: 'Set a variable name to reference each item',
    });
  }

  return issues;
}

function validateTransformNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as TransformNodeData;

  const outputKeys = Object.keys(data.output || {});
  if (outputKeys.length === 0) {
    issues.push({
      nodeId: node.id,
      field: 'output',
      severity: 'warning',
      message: 'No output mapping defined',
      suggestion: 'Define what data this transform produces',
    });
  }

  return issues;
}

function validateSuspendNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as SuspendNodeData;

  const schemaProperties = data.resumeSchema?.properties as Record<string, unknown> | undefined;
  if (!schemaProperties || Object.keys(schemaProperties).length === 0) {
    issues.push({
      nodeId: node.id,
      field: 'resumeSchema',
      severity: 'warning',
      message: 'No resume input schema defined',
      suggestion: 'Define what data the human needs to provide',
    });
  }

  return issues;
}

function validateWorkflowNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as WorkflowNodeData;

  if (!data.workflowId) {
    issues.push({
      nodeId: node.id,
      field: 'workflowId',
      severity: 'error',
      message: 'Workflow is required',
      suggestion: 'Select a workflow to call',
    });
  }

  return issues;
}

function validateSleepNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as SleepNodeData;

  if (data.sleepType === 'duration') {
    if (!data.duration || data.duration <= 0) {
      issues.push({
        nodeId: node.id,
        field: 'duration',
        severity: 'error',
        message: 'Sleep duration must be greater than 0',
        suggestion: 'Set a positive duration in milliseconds',
      });
    }
  } else if (data.sleepType === 'timestamp') {
    if (!data.timestamp) {
      issues.push({
        nodeId: node.id,
        field: 'timestamp',
        severity: 'error',
        message: 'Timestamp is required',
        suggestion: 'Configure the timestamp to wait until',
      });
    }
  }

  return issues;
}

function validateAgentNetworkNode(node: BuilderNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = node.data as AgentNetworkNodeData;

  if (!data.networkId) {
    issues.push({
      nodeId: node.id,
      field: 'networkId',
      severity: 'error',
      message: 'Agent network is required',
      suggestion: 'Select an agent network',
    });
  }

  if (!data.agents || data.agents.length === 0) {
    issues.push({
      nodeId: node.id,
      field: 'agents',
      severity: 'warning',
      message: 'No agents in the network',
      suggestion: 'Add agents to the network',
    });
  }

  return issues;
}

// ============================================================================
// Node Validators Registry
// ============================================================================

const nodeValidators: Record<BuilderNodeType, (node: BuilderNode, allNodes: BuilderNode[]) => ValidationIssue[]> = {
  trigger: validateTriggerNode,
  agent: node => validateAgentNode(node),
  tool: node => validateToolNode(node),
  condition: node => validateConditionNode(node),
  parallel: node => validateParallelNode(node),
  loop: node => validateLoopNode(node),
  foreach: node => validateForeachNode(node),
  transform: node => validateTransformNode(node),
  suspend: node => validateSuspendNode(node),
  workflow: node => validateWorkflowNode(node),
  sleep: node => validateSleepNode(node),
  'agent-network': node => validateAgentNetworkNode(node),
};

// ============================================================================
// Graph Validation
// ============================================================================

function validateGraph(nodes: BuilderNode[], edges: BuilderEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for trigger node
  const triggerNodes = nodes.filter(n => n.data.type === 'trigger');
  if (triggerNodes.length === 0) {
    issues.push({
      nodeId: 'workflow',
      severity: 'error',
      message: 'Workflow must have a trigger node',
      suggestion: 'Add a trigger node as the workflow entry point',
    });
  }

  // Build adjacency list for reachability analysis
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(n => adjacencyList.set(n.id, []));
  edges.forEach(e => {
    const sources = adjacencyList.get(e.source);
    if (sources) {
      sources.push(e.target);
    }
  });

  // Check reachability from trigger
  const reachable = new Set<string>();
  if (triggerNodes.length > 0) {
    const queue = [triggerNodes[0].id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      const neighbors = adjacencyList.get(current) || [];
      queue.push(...neighbors);
    }
  }

  // Check for orphaned nodes
  nodes.forEach(n => {
    if (n.data.type !== 'trigger' && !reachable.has(n.id)) {
      issues.push({
        nodeId: n.id,
        severity: 'warning',
        message: 'Node is not reachable from trigger',
        suggestion: 'Connect this node to the workflow or remove it',
      });
    }
  });

  // Check for nodes with no outgoing edges (except terminal nodes are fine)
  const terminalTypes: BuilderNodeType[] = ['suspend']; // Suspend is allowed to be terminal
  nodes.forEach(n => {
    if (terminalTypes.includes(n.data.type as BuilderNodeType)) return;

    const outgoing = edges.filter(e => e.source === n.id);
    if (outgoing.length === 0 && reachable.has(n.id)) {
      issues.push({
        nodeId: n.id,
        severity: 'warning',
        message: 'Node has no outgoing connections',
        suggestion: 'Connect this node to subsequent steps or mark it as the end of the workflow',
      });
    }
  });

  // Check for trigger nodes receiving incoming edges
  triggerNodes.forEach(t => {
    const incoming = edges.filter(e => e.target === t.id);
    if (incoming.length > 0) {
      issues.push({
        nodeId: t.id,
        severity: 'error',
        message: 'Trigger node cannot have incoming connections',
        suggestion: 'Remove connections pointing to the trigger',
      });
    }
  });

  return issues;
}

// ============================================================================
// Main Validation Function
// ============================================================================

export function validateWorkflow(nodes: BuilderNode[], edges: BuilderEdge[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Validate each node
  nodes.forEach(node => {
    const validator = nodeValidators[node.data.type as BuilderNodeType];
    if (validator) {
      issues.push(...validator(node, nodes));
    }
  });

  // Validate graph structure
  issues.push(...validateGraph(nodes, edges));

  // Separate errors and warnings
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getIssuesForNode(result: ValidationResult, nodeId: string): ValidationIssue[] {
  return result.issues.filter(i => i.nodeId === nodeId);
}

export function hasErrorsForNode(result: ValidationResult, nodeId: string): boolean {
  return result.errors.some(i => i.nodeId === nodeId);
}

export function hasWarningsForNode(result: ValidationResult, nodeId: string): boolean {
  return result.warnings.some(i => i.nodeId === nodeId);
}
