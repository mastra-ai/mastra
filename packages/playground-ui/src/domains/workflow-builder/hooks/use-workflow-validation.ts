import { useMemo } from 'react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import type { BuilderNode, BuilderEdge, AgentNodeData, ToolNodeData, ConditionNodeData } from '../types';

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
