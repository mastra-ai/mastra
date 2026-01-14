import type { Node, Edge } from '@xyflow/react';
import type { VariableRef, ValueOrRef, ConditionDef, StorageWorkflowDefinitionType } from '@mastra/core/storage';

// Re-export for convenience
export type { VariableRef, ValueOrRef, ConditionDef, StorageWorkflowDefinitionType };

// ============================================================================
// Flexible Input Type (accepts both StorageWorkflowDefinitionType and API response)
// ============================================================================

export interface WorkflowDefinitionInput {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph: unknown[];
  steps: Record<string, unknown>;
}

// ============================================================================
// Node Type Identifiers
// ============================================================================

export type BuilderNodeType =
  | 'trigger'
  | 'agent'
  | 'tool'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'foreach'
  | 'transform'
  | 'suspend'
  | 'workflow'
  | 'sleep'
  | 'agent-network';

// ============================================================================
// Node Data Interfaces
// ============================================================================

interface BaseNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  /** User comment/annotation for this node */
  comment?: string;
}

export interface TriggerNodeData extends BaseNodeData {
  type: 'trigger';
}

export interface AgentNodeData extends BaseNodeData {
  type: 'agent';
  agentId: string | null;
  prompt: VariableRef | null;
  instructions?: string;
  structuredOutput?: Record<string, unknown>;
}

export interface ToolNodeData extends BaseNodeData {
  type: 'tool';
  toolId: string | null;
  input: Record<string, ValueOrRef>;
}

export interface ConditionBranch {
  id: string;
  label: string;
  condition: ConditionDef | null;
}

export interface ConditionNodeData extends BaseNodeData {
  type: 'condition';
  branches: ConditionBranch[];
  defaultBranch?: string;
}

export interface ParallelBranch {
  id: string;
  label: string;
}

export interface ParallelNodeData extends BaseNodeData {
  type: 'parallel';
  branches: ParallelBranch[];
}

export interface LoopNodeData extends BaseNodeData {
  type: 'loop';
  loopType: 'dowhile' | 'dountil';
  condition: ConditionDef | null;
  maxIterations?: number;
}

export interface ForeachNodeData extends BaseNodeData {
  type: 'foreach';
  collection: VariableRef | null;
  concurrency?: number;
  itemVariable: string;
}

export interface TransformNodeData extends BaseNodeData {
  type: 'transform';
  output: Record<string, ValueOrRef>;
  outputSchema: Record<string, unknown>;
}

export interface SuspendNodeData extends BaseNodeData {
  type: 'suspend';
  resumeSchema: Record<string, unknown>;
  payload?: Record<string, ValueOrRef>;
}

export interface WorkflowNodeData extends BaseNodeData {
  type: 'workflow';
  workflowId: string | null;
  input: Record<string, ValueOrRef>;
}

export interface SleepNodeData extends BaseNodeData {
  type: 'sleep';
  sleepType: 'duration' | 'timestamp';
  duration?: number; // in milliseconds
  timestamp?: ValueOrRef;
}

export interface AgentNetworkNodeData extends BaseNodeData {
  type: 'agent-network';
  networkId: string | null;
  agents: string[]; // Agent IDs in network
  routingStrategy: 'round-robin' | 'capability' | 'priority';
  prompt: VariableRef | null;
}

export type BuilderNodeData =
  | TriggerNodeData
  | AgentNodeData
  | ToolNodeData
  | ConditionNodeData
  | ParallelNodeData
  | LoopNodeData
  | ForeachNodeData
  | TransformNodeData
  | SuspendNodeData
  | WorkflowNodeData
  | SleepNodeData
  | AgentNetworkNodeData;

// ============================================================================
// React Flow Types
// ============================================================================

export type BuilderNode = Node<BuilderNodeData, BuilderNodeType>;

export interface BuilderEdgeData extends Record<string, unknown> {
  label?: string;
  branchId?: string;
}

export type BuilderEdge = Edge<BuilderEdgeData>;

// ============================================================================
// History Types
// ============================================================================

export interface HistoryEntry {
  nodes: BuilderNode[];
  edges: BuilderEdge[];
  timestamp: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createTriggerNodeData(label = 'Trigger'): TriggerNodeData {
  return {
    type: 'trigger',
    label,
  };
}

export function createAgentNodeData(label = 'Agent Step'): AgentNodeData {
  return {
    type: 'agent',
    label,
    agentId: null,
    prompt: null,
  };
}

export function createToolNodeData(label = 'Tool Step'): ToolNodeData {
  return {
    type: 'tool',
    label,
    toolId: null,
    input: {},
  };
}

export function createConditionNodeData(label = 'Condition'): ConditionNodeData {
  return {
    type: 'condition',
    label,
    branches: [
      { id: 'true', label: 'Yes', condition: null },
      { id: 'false', label: 'No', condition: null },
    ],
  };
}

export function createParallelNodeData(label = 'Parallel'): ParallelNodeData {
  return {
    type: 'parallel',
    label,
    branches: [
      { id: 'branch-1', label: 'Branch 1' },
      { id: 'branch-2', label: 'Branch 2' },
    ],
  };
}

export function createLoopNodeData(label = 'Loop'): LoopNodeData {
  return {
    type: 'loop',
    label,
    loopType: 'dowhile',
    condition: null,
    maxIterations: 10,
  };
}

export function createForeachNodeData(label = 'For Each'): ForeachNodeData {
  return {
    type: 'foreach',
    label,
    collection: null,
    concurrency: 1,
    itemVariable: 'item',
  };
}

export function createTransformNodeData(label = 'Transform'): TransformNodeData {
  return {
    type: 'transform',
    label,
    output: {},
    outputSchema: {},
  };
}

export function createSuspendNodeData(label = 'Human Input'): SuspendNodeData {
  return {
    type: 'suspend',
    label,
    resumeSchema: {
      type: 'object',
      properties: {},
    },
    payload: {},
  };
}

export function createWorkflowNodeData(label = 'Sub-Workflow'): WorkflowNodeData {
  return {
    type: 'workflow',
    label,
    workflowId: null,
    input: {},
  };
}

export function createSleepNodeData(label = 'Sleep'): SleepNodeData {
  return {
    type: 'sleep',
    label,
    sleepType: 'duration',
    duration: 1000, // 1 second default
  };
}

export function createAgentNetworkNodeData(label = 'Agent Network'): AgentNetworkNodeData {
  return {
    type: 'agent-network',
    label,
    networkId: null,
    agents: [],
    routingStrategy: 'round-robin',
    prompt: null,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTriggerNode(node: BuilderNode): node is Node<TriggerNodeData, 'trigger'> {
  return node.data.type === 'trigger';
}

export function isAgentNode(node: BuilderNode): node is Node<AgentNodeData, 'agent'> {
  return node.data.type === 'agent';
}

export function isToolNode(node: BuilderNode): node is Node<ToolNodeData, 'tool'> {
  return node.data.type === 'tool';
}

export function isConditionNode(node: BuilderNode): node is Node<ConditionNodeData, 'condition'> {
  return node.data.type === 'condition';
}

export function isParallelNode(node: BuilderNode): node is Node<ParallelNodeData, 'parallel'> {
  return node.data.type === 'parallel';
}

export function isLoopNode(node: BuilderNode): node is Node<LoopNodeData, 'loop'> {
  return node.data.type === 'loop';
}

export function isForeachNode(node: BuilderNode): node is Node<ForeachNodeData, 'foreach'> {
  return node.data.type === 'foreach';
}

export function isTransformNode(node: BuilderNode): node is Node<TransformNodeData, 'transform'> {
  return node.data.type === 'transform';
}

export function isSuspendNode(node: BuilderNode): node is Node<SuspendNodeData, 'suspend'> {
  return node.data.type === 'suspend';
}

export function isWorkflowNode(node: BuilderNode): node is Node<WorkflowNodeData, 'workflow'> {
  return node.data.type === 'workflow';
}

export function isSleepNode(node: BuilderNode): node is Node<SleepNodeData, 'sleep'> {
  return node.data.type === 'sleep';
}

export function isAgentNetworkNode(node: BuilderNode): node is Node<AgentNetworkNodeData, 'agent-network'> {
  return node.data.type === 'agent-network';
}
