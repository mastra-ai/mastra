import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import type {
  BuilderNode,
  BuilderEdge,
  BuilderNodeType,
  BuilderNodeData,
  HistoryEntry,
  StorageWorkflowDefinitionType,
  WorkflowDefinitionInput,
} from '../types';
import {
  createTriggerNodeData,
  createAgentNodeData,
  createToolNodeData,
  createConditionNodeData,
  createParallelNodeData,
  createLoopNodeData,
  createForeachNodeData,
  createTransformNodeData,
  createSuspendNodeData,
  createWorkflowNodeData,
  createSleepNodeData,
  createAgentNetworkNodeData,
} from '../types';
import { deserializeDefinition } from '../utils/deserialize';
import { validateWorkflow, type ValidationResult } from '../utils/validate';
import { serializeGraph } from '../utils/serialize';
import { autoLayout } from '../utils/auto-layout';

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY = 50;

// ============================================================================
// Execution State Types
// ============================================================================

export type ExecutionStepStatus = 'pending' | 'running' | 'success' | 'error';

export interface ExecutionStepResult {
  status: ExecutionStepStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

// ============================================================================
// State Interface
// ============================================================================

interface WorkflowBuilderState {
  // Graph state
  nodes: BuilderNode[];
  edges: BuilderEdge[];

  // Selection (supports both single and multi-select)
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;

  // Execution state (for real-time visualization)
  executingStepId: string | null;
  stepResults: Record<string, ExecutionStepResult>;

  // Clipboard for copy/paste
  clipboard: {
    nodes: BuilderNode[];
    edges: BuilderEdge[];
  } | null;

  // Quick-add state (for keyboard triggering)
  quickAddTargetNodeId: string | null;

  // Workflow metadata
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema: Record<string, unknown>;

  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;

  // Status
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // Deserialization error (set when loadFromDefinition fails partially)
  deserializationError: string | null;

  // Validation
  validationResult: ValidationResult | null;

  // Layout version (incremented when auto-layout is triggered)
  layoutVersion: number;

  // React Flow callbacks
  onNodesChange: OnNodesChange<BuilderNode>;
  onEdgesChange: OnEdgesChange<BuilderEdge>;
  onConnect: OnConnect;

  // Actions: Graph manipulation
  setNodes: (nodes: BuilderNode[]) => void;
  setEdges: (edges: BuilderEdge[]) => void;
  addNode: (type: BuilderNodeType, position: { x: number; y: number }) => string;
  addConnectedNode: (sourceNodeId: string, type: BuilderNodeType, sourceHandle?: string) => string;
  updateNodeData: <T extends BuilderNodeData>(id: string, data: Partial<T>) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  duplicateNode: (id: string) => string | null;

  // Actions: Selection
  selectNode: (id: string | null, additive?: boolean) => void;
  selectNodes: (ids: string[]) => void;
  toggleNodeSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  copySelected: () => void;
  paste: () => void;
  triggerQuickAdd: (nodeId: string | null) => void;

  // Actions: History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions: Layout
  autoLayout: () => void;

  // Actions: Persistence
  reset: () => void;
  loadFromDefinition: (definition: WorkflowDefinitionInput) => void;
  toDefinition: () => { definition: Partial<StorageWorkflowDefinitionType>; warnings: string[] };
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  clearDeserializationError: () => void;

  // Actions: Metadata
  setWorkflowMeta: (meta: { name?: string; description?: string }) => void;

  // Actions: Validation
  runValidation: () => void;
  clearValidation: () => void;

  // Actions: Execution state (for real-time visualization)
  setExecutingStep: (stepId: string | null) => void;
  setStepResult: (stepId: string, result: ExecutionStepResult) => void;
  clearExecutionState: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useWorkflowBuilderStore = create<WorkflowBuilderState>()((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedNodeIds: new Set<string>(),
  executingStepId: null,
  stepResults: {},
  clipboard: null,
  quickAddTargetNodeId: null,
  workflowId: null,
  workflowName: '',
  workflowDescription: '',
  inputSchema: {},
  outputSchema: {},
  stateSchema: {},
  history: [],
  historyIndex: -1,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  deserializationError: null,
  validationResult: null,
  layoutVersion: 0,

  // ========================================================================
  // React Flow Callbacks
  // ========================================================================

  onNodesChange: changes => {
    set(state => ({
      nodes: applyNodeChanges(changes, state.nodes) as BuilderNode[],
      isDirty: true,
    }));
  },

  onEdgesChange: changes => {
    set(state => ({
      edges: applyEdgeChanges(changes, state.edges) as BuilderEdge[],
      isDirty: true,
    }));
  },

  onConnect: (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const newEdge: BuilderEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: 'data',
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };

    set(state => ({
      edges: [...state.edges, newEdge],
      isDirty: true,
    }));

    get().pushHistory();
  },

  // ========================================================================
  // Graph Manipulation
  // ========================================================================

  setNodes: nodes => {
    set({ nodes });
  },

  setEdges: edges => {
    set({ edges });
  },

  addNode: (type, position) => {
    const id = crypto.randomUUID();

    const dataFactories: Record<BuilderNodeType, () => BuilderNodeData> = {
      trigger: createTriggerNodeData,
      agent: createAgentNodeData,
      tool: createToolNodeData,
      condition: createConditionNodeData,
      parallel: createParallelNodeData,
      loop: createLoopNodeData,
      foreach: createForeachNodeData,
      transform: createTransformNodeData,
      suspend: createSuspendNodeData,
      workflow: createWorkflowNodeData,
      sleep: createSleepNodeData,
      'agent-network': createAgentNetworkNodeData,
    };

    const node: BuilderNode = {
      id,
      type,
      position,
      data: dataFactories[type](),
    };

    set(state => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }));

    get().pushHistory();
    return id;
  },

  addConnectedNode: (sourceNodeId, type, sourceHandle) => {
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === sourceNodeId);

    if (!sourceNode) {
      console.warn('[WorkflowBuilder] addConnectedNode: source node not found', sourceNodeId);
      return '';
    }

    // Position new node 150px below the source node
    const newPosition = {
      x: sourceNode.position.x,
      y: sourceNode.position.y + 150,
    };

    const newId = crypto.randomUUID();

    const dataFactories: Record<BuilderNodeType, () => BuilderNodeData> = {
      trigger: createTriggerNodeData,
      agent: createAgentNodeData,
      tool: createToolNodeData,
      condition: createConditionNodeData,
      parallel: createParallelNodeData,
      loop: createLoopNodeData,
      foreach: createForeachNodeData,
      transform: createTransformNodeData,
      suspend: createSuspendNodeData,
      workflow: createWorkflowNodeData,
      sleep: createSleepNodeData,
      'agent-network': createAgentNetworkNodeData,
    };

    const newNode: BuilderNode = {
      id: newId,
      type,
      position: newPosition,
      data: dataFactories[type](),
    };

    const newEdge: BuilderEdge = {
      id: `e-${sourceNodeId}-${newId}-${Date.now()}`,
      type: 'data',
      source: sourceNodeId,
      target: newId,
      sourceHandle: sourceHandle,
    };

    set(state => ({
      nodes: [...state.nodes, newNode],
      edges: [...state.edges, newEdge],
      selectedNodeId: newId,
      isDirty: true,
    }));

    get().pushHistory();
    return newId;
  },

  updateNodeData: (id, data) => {
    set(state => ({
      nodes: state.nodes.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...data } as BuilderNodeData } : node,
      ),
      isDirty: true,
    }));
  },

  deleteNode: id => {
    set(state => ({
      nodes: state.nodes.filter(n => n.id !== id),
      edges: state.edges.filter(e => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
    }));

    get().pushHistory();
  },

  deleteEdge: (id: string) => {
    set(state => ({
      edges: state.edges.filter(e => e.id !== id),
      isDirty: true,
    }));

    get().pushHistory();
  },

  duplicateNode: id => {
    const { nodes } = get();
    const nodeToDuplicate = nodes.find(n => n.id === id);

    if (!nodeToDuplicate) return null;

    // Don't allow duplicating trigger nodes
    if (nodeToDuplicate.data.type === 'trigger') return null;

    const newId = `${nodeToDuplicate.data.type}_${Date.now()}`;
    const newNode: BuilderNode = {
      ...nodeToDuplicate,
      id: newId,
      position: {
        x: nodeToDuplicate.position.x + 50,
        y: nodeToDuplicate.position.y + 50,
      },
      data: {
        ...JSON.parse(JSON.stringify(nodeToDuplicate.data)),
        label: `${nodeToDuplicate.data.label} (copy)`,
      },
      selected: false,
    };

    set(state => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: newId,
      isDirty: true,
    }));

    get().pushHistory();
    return newId;
  },

  // ========================================================================
  // Selection
  // ========================================================================

  selectNode: (id, additive = false) => {
    if (additive && id) {
      // Add to existing selection
      set(state => {
        const newSet = new Set(state.selectedNodeIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return {
          selectedNodeId: newSet.size === 1 ? Array.from(newSet)[0] : id,
          selectedNodeIds: newSet,
        };
      });
    } else {
      // Replace selection
      set({
        selectedNodeId: id,
        selectedNodeIds: id ? new Set([id]) : new Set(),
      });
    }
  },

  selectNodes: (ids: string[]) => {
    set({
      selectedNodeId: ids.length > 0 ? ids[0] : null,
      selectedNodeIds: new Set(ids),
    });
  },

  toggleNodeSelection: (id: string) => {
    set(state => {
      const newSet = new Set(state.selectedNodeIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return {
        selectedNodeId: newSet.size > 0 ? (newSet.has(id) ? id : Array.from(newSet)[0]) : null,
        selectedNodeIds: newSet,
      };
    });
  },

  selectAll: () => {
    const { nodes } = get();
    const allIds = nodes.map(n => n.id);
    set({
      selectedNodeId: allIds.length > 0 ? allIds[0] : null,
      selectedNodeIds: new Set(allIds),
    });
  },

  clearSelection: () => {
    set({
      selectedNodeId: null,
      selectedNodeIds: new Set(),
    });
  },

  deleteSelected: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.size === 0) return;

    // Don't delete trigger nodes
    const idsToDelete = Array.from(selectedNodeIds).filter(id => {
      const node = nodes.find(n => n.id === id);
      return node && node.data.type !== 'trigger';
    });

    if (idsToDelete.length === 0) return;

    const idSet = new Set(idsToDelete);
    set({
      nodes: nodes.filter(n => !idSet.has(n.id)),
      edges: edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target)),
      selectedNodeId: null,
      selectedNodeIds: new Set(),
      isDirty: true,
    });

    get().pushHistory();
  },

  copySelected: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.size === 0) return;

    // Get selected nodes (excluding trigger)
    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id) && n.data.type !== 'trigger');

    if (selectedNodes.length === 0) return;

    // Get edges that connect selected nodes to each other
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const internalEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target));

    set({
      clipboard: {
        nodes: JSON.parse(JSON.stringify(selectedNodes)),
        edges: JSON.parse(JSON.stringify(internalEdges)),
      },
    });
  },

  paste: () => {
    const { clipboard, nodes } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Create ID mapping from old to new IDs
    const idMap = new Map<string, string>();
    const timestamp = Date.now();

    // Create new nodes with offset position
    const newNodes: BuilderNode[] = clipboard.nodes.map((node, i) => {
      const newId = `${node.data.type}_${timestamp}_${i}`;
      idMap.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: {
          ...node.data,
          label: `${node.data.label} (copy)`,
        },
        selected: false,
      };
    });

    // Create new edges with updated IDs
    const newEdges = clipboard.edges
      .map((edge): BuilderEdge | null => {
        const newSource = idMap.get(edge.source);
        const newTarget = idMap.get(edge.target);
        if (!newSource || !newTarget) return null;

        return {
          ...edge,
          id: `e-${newSource}-${newTarget}-${timestamp}`,
          type: 'data',
          source: newSource,
          target: newTarget,
        };
      })
      .filter((e): e is BuilderEdge => e !== null);

    // Add to graph and select the new nodes
    const newNodeIds = new Set(newNodes.map(n => n.id));

    set(state => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
      selectedNodeId: newNodes.length > 0 ? newNodes[0].id : null,
      selectedNodeIds: newNodeIds,
      isDirty: true,
    }));

    get().pushHistory();
  },

  triggerQuickAdd: nodeId => {
    set({ quickAddTargetNodeId: nodeId });
  },

  // ========================================================================
  // History (Undo/Redo)
  // ========================================================================

  pushHistory: () => {
    set(state => {
      const entry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        edges: JSON.parse(JSON.stringify(state.edges)),
        timestamp: Date.now(),
      };

      // Remove any future history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }

      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const entry = history[newIndex];

    set({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const entry = history[newIndex];

    set({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      historyIndex: newIndex,
      isDirty: true,
    });
  },

  canUndo: () => {
    return get().historyIndex > 0;
  },

  canRedo: () => {
    const { historyIndex, history } = get();
    return historyIndex < history.length - 1;
  },

  // ========================================================================
  // Layout
  // ========================================================================

  autoLayout: () => {
    const { nodes, edges, layoutVersion } = get();

    if (nodes.length === 0) return;

    const result = autoLayout(nodes, edges);

    set({
      nodes: result.nodes,
      isDirty: true,
      layoutVersion: layoutVersion + 1,
    });

    get().pushHistory();
  },

  // ========================================================================
  // Persistence
  // ========================================================================

  reset: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: new Set<string>(),
      executingStepId: null,
      stepResults: {},
      quickAddTargetNodeId: null,
      workflowId: null,
      workflowName: '',
      workflowDescription: '',
      inputSchema: {},
      outputSchema: {},
      stateSchema: {},
      history: [],
      historyIndex: -1,
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      deserializationError: null,
      validationResult: null,
      layoutVersion: 0,
    });
  },

  loadFromDefinition: definition => {
    console.log('[WorkflowBuilder] loadFromDefinition called with:', definition);

    // Use default input schema if none provided
    const defaultInputSchema = {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The input prompt for the workflow',
        },
      },
      required: ['prompt'],
    };

    const hasInputSchema =
      definition.inputSchema &&
      typeof definition.inputSchema === 'object' &&
      Object.keys(definition.inputSchema).length > 0;

    // Deserialize the definition to React Flow nodes/edges
    const hasSteps = definition.steps && Object.keys(definition.steps).length > 0;
    const hasStepGraph = definition.stepGraph && definition.stepGraph.length > 0;
    let nodes: BuilderNode[];
    let edges: BuilderEdge[];
    let deserializationError: string | null = null;

    if (hasSteps && hasStepGraph) {
      // Use deserializer to convert stored definition to React Flow format
      try {
        const deserialized = deserializeDefinition(definition as StorageWorkflowDefinitionType);
        nodes = deserialized.nodes;
        edges = deserialized.edges;
        console.log('[WorkflowBuilder] Deserialized definition:', { nodes, edges });
      } catch (err) {
        console.error('[WorkflowBuilder] Failed to deserialize definition:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        deserializationError = `Failed to load workflow: ${errorMessage}. Starting with empty canvas.`;
        // Fallback to empty canvas
        nodes = [
          {
            id: 'trigger',
            type: 'trigger' as const,
            position: { x: 250, y: 50 },
            data: createTriggerNodeData(),
          },
        ];
        edges = [];
      }
    } else {
      // No steps - create empty canvas with just a trigger node
      nodes = [
        {
          id: 'trigger',
          type: 'trigger' as const,
          position: { x: 250, y: 50 },
          data: createTriggerNodeData(),
        },
      ];
      edges = [];
    }

    set({
      workflowId: definition.id,
      workflowName: definition.name,
      workflowDescription: definition.description ?? '',
      inputSchema: hasInputSchema ? definition.inputSchema : defaultInputSchema,
      outputSchema: definition.outputSchema,
      stateSchema: definition.stateSchema || {},
      isDirty: false,
      history: [],
      historyIndex: -1,
      nodes,
      edges,
      deserializationError,
    });

    get().pushHistory();
  },

  toDefinition: () => {
    const state = get();
    const { stepGraph, steps, warnings } = serializeGraph(state.nodes, state.edges);

    return {
      definition: {
        id: state.workflowId ?? '',
        name: state.workflowName,
        description: state.workflowDescription,
        inputSchema: state.inputSchema,
        outputSchema: state.outputSchema,
        stateSchema: state.stateSchema,
        stepGraph,
        steps,
      },
      warnings,
    };
  },

  setDirty: dirty => {
    set({ isDirty: dirty });
  },

  setSaving: saving => {
    set(state => ({
      isSaving: saving,
      lastSavedAt: saving ? state.lastSavedAt : new Date(),
    }));
  },

  clearDeserializationError: () => {
    set({ deserializationError: null });
  },

  // ========================================================================
  // Metadata
  // ========================================================================

  setWorkflowMeta: meta => {
    set(state => ({
      workflowName: meta.name !== undefined ? meta.name : state.workflowName,
      workflowDescription: meta.description !== undefined ? meta.description : state.workflowDescription,
      isDirty: true,
    }));
  },

  // ========================================================================
  // Validation
  // ========================================================================

  runValidation: () => {
    const { nodes, edges } = get();
    const result = validateWorkflow(nodes, edges);
    set({ validationResult: result });
  },

  clearValidation: () => {
    set({ validationResult: null });
  },

  // ========================================================================
  // Execution State (for real-time visualization)
  // ========================================================================

  setExecutingStep: (stepId: string | null) => {
    set({ executingStepId: stepId });
  },

  setStepResult: (stepId: string, result: ExecutionStepResult) => {
    set(state => ({
      stepResults: {
        ...state.stepResults,
        [stepId]: result,
      },
    }));
  },

  clearExecutionState: () => {
    set({
      executingStepId: null,
      stepResults: {},
    });
  },
}));

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectNodes = (state: WorkflowBuilderState) => state.nodes;
export const selectEdges = (state: WorkflowBuilderState) => state.edges;
export const selectSelectedNodeId = (state: WorkflowBuilderState) => state.selectedNodeId;
export const selectSelectedNode = (state: WorkflowBuilderState) =>
  state.nodes.find(n => n.id === state.selectedNodeId) ?? null;
export const selectQuickAddTargetNodeId = (state: WorkflowBuilderState) => state.quickAddTargetNodeId;
export const selectIsDirty = (state: WorkflowBuilderState) => state.isDirty;
export const selectIsSaving = (state: WorkflowBuilderState) => state.isSaving;
export const selectWorkflowMeta = (state: WorkflowBuilderState) => ({
  id: state.workflowId,
  name: state.workflowName,
  description: state.workflowDescription,
});
export const selectCanUndo = (state: WorkflowBuilderState) => state.historyIndex > 0;
export const selectCanRedo = (state: WorkflowBuilderState) => state.historyIndex < state.history.length - 1;
export const selectValidationResult = (state: WorkflowBuilderState) => state.validationResult;
export const selectIsValid = (state: WorkflowBuilderState) => state.validationResult?.isValid ?? true;
export const selectDeserializationError = (state: WorkflowBuilderState) => state.deserializationError;

// Execution state selectors
export const selectExecutingStepId = (state: WorkflowBuilderState) => state.executingStepId;
export const selectStepResults = (state: WorkflowBuilderState) => state.stepResults;
export const selectStepResult = (stepId: string) => (state: WorkflowBuilderState) => state.stepResults[stepId];
export const selectIsStepExecuting = (stepId: string) => (state: WorkflowBuilderState) =>
  state.executingStepId === stepId;

// Layout selectors
export const selectLayoutVersion = (state: WorkflowBuilderState) => state.layoutVersion;
