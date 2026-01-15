import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
  BackgroundVariant,
  SelectionMode,
} from '@xyflow/react';
import { useWorkflowBuilderStore, selectLayoutVersion } from '../store/workflow-builder-store';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { EmptyState } from './empty-state';
import type { BuilderNode, BuilderNodeType } from '../types';
import { cn } from '@/lib/utils';

// Memoized constants to prevent re-renders
const DEFAULT_EDGE_OPTIONS = {
  animated: true,
  style: { stroke: '#6b7280', strokeWidth: 2 },
} as const;

const CONNECTION_LINE_STYLE = { stroke: '#6b7280', strokeWidth: 2 } as const;

const FIT_VIEW_OPTIONS = { padding: 0.4, maxZoom: 1 } as const;

const SNAP_GRID: [number, number] = [16, 16];

export interface BuilderCanvasProps {
  className?: string;
}

export function BuilderCanvas({ className }: BuilderCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Store selectors
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);
  const selectedNodeId = useWorkflowBuilderStore(state => state.selectedNodeId);
  const onNodesChange = useWorkflowBuilderStore(state => state.onNodesChange);
  const onEdgesChange = useWorkflowBuilderStore(state => state.onEdgesChange);
  const onConnect = useWorkflowBuilderStore(state => state.onConnect);
  const selectNode = useWorkflowBuilderStore(state => state.selectNode);
  const clearSelection = useWorkflowBuilderStore(state => state.clearSelection);
  const selectNodes = useWorkflowBuilderStore(state => state.selectNodes);
  const selectAll = useWorkflowBuilderStore(state => state.selectAll);
  const deleteSelected = useWorkflowBuilderStore(state => state.deleteSelected);
  const copySelected = useWorkflowBuilderStore(state => state.copySelected);
  const paste = useWorkflowBuilderStore(state => state.paste);
  const addNode = useWorkflowBuilderStore(state => state.addNode);
  const triggerQuickAdd = useWorkflowBuilderStore(state => state.triggerQuickAdd);
  const layoutVersion = useWorkflowBuilderStore(selectLayoutVersion);

  // Track layout version to trigger animation
  const prevLayoutVersionRef = useRef(layoutVersion);

  // Fit view when nodes change (e.g., after loading a definition)
  useEffect(() => {
    if (nodes.length > 0) {
      console.log('[BuilderCanvas] Nodes loaded:', nodes.length, 'nodes');
      // Small delay to ensure React Flow has rendered the nodes
      const timer = setTimeout(() => {
        console.log('[BuilderCanvas] Fitting view...');
        reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, reactFlowInstance]);

  // Animate fit view when layout changes (auto-layout triggered)
  useEffect(() => {
    if (layoutVersion > prevLayoutVersionRef.current) {
      // Layout was triggered, animate to fit new positions
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
      }, 50);
      prevLayoutVersionRef.current = layoutVersion;
      return () => clearTimeout(timer);
    }
  }, [layoutVersion, reactFlowInstance]);

  // Keyboard shortcut: Tab to trigger quick-add on selected node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab key triggers quick-add on selected node
      if (e.key === 'Tab' && selectedNodeId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Check if the selected node has a bottom handle (can have children)
        const selectedNode = nodes.find(n => n.id === selectedNodeId);
        if (selectedNode && selectedNode.type !== 'condition') {
          // Conditions have multiple handles, so we skip them for now
          e.preventDefault();
          triggerQuickAdd(selectedNodeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, triggerQuickAdd]);

  // Handle node click - select the node (with shift for multi-select)
  const handleNodeClick: NodeMouseHandler<BuilderNode> = useCallback(
    (event, node) => {
      const isShiftClick = event.shiftKey;
      selectNode(node.id, isShiftClick);
    },
    [selectNode],
  );

  // Handle pane click - deselect all
  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle selection change from React Flow's built-in box selection
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length > 0) {
        selectNodes(selectedNodes.map(n => n.id));
      }
    },
    [selectNodes],
  );

  // Keyboard shortcuts for selection and clipboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Select all (Cmd+A)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInputFocused) {
        e.preventDefault();
        selectAll();
      }
      // Copy (Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isInputFocused) {
        e.preventDefault();
        copySelected();
      }
      // Paste (Cmd+V)
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !isInputFocused) {
        e.preventDefault();
        paste();
      }
      // Delete selected (Backspace/Delete)
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey && !isInputFocused) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, copySelected, paste, deleteSelected]);

  // Handle drag over - allow drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop - create new node
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/workflow-node-type') as BuilderNodeType;

      if (!type) return;

      // Get the position relative to the React Flow canvas
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [reactFlowInstance, addNode],
  );

  return (
    <div ref={reactFlowWrapper} className={cn('h-full', className)} onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        snapToGrid
        snapGrid={SNAP_GRID}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#374151" />
        <Controls
          className="!bg-surface3 !border-border1 !rounded-lg !shadow-lg"
          showZoom
          showFitView
          showInteractive={false}
        />
        <MiniMap
          className="!bg-surface3 !border-border1 !rounded-lg"
          nodeColor="#4b5563"
          maskColor="rgba(0, 0, 0, 0.8)"
          pannable
          zoomable
        />

        {/* Empty state overlay */}
        <EmptyState />
      </ReactFlow>
    </div>
  );
}
