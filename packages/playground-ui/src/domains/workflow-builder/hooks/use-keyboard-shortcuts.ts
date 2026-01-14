import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'navigation' | 'editing' | 'selection' | 'view' | 'general';
  action: () => void;
}

export interface ShortcutConfig {
  id: string;
  keys: string; // Display string like "Ctrl+Z" or "Cmd+Z"
  description: string;
  category: KeyboardShortcut['category'];
}

// ============================================================================
// Shortcut Definitions (for display)
// ============================================================================

export const SHORTCUT_DEFINITIONS: ShortcutConfig[] = [
  // General
  { id: 'save', keys: 'Ctrl/Cmd + S', description: 'Save workflow', category: 'general' },
  { id: 'command-palette', keys: 'Ctrl/Cmd + K', description: 'Open command palette', category: 'general' },
  { id: 'help', keys: '?', description: 'Show keyboard shortcuts', category: 'general' },

  // Editing
  { id: 'undo', keys: 'Ctrl/Cmd + Z', description: 'Undo last action', category: 'editing' },
  { id: 'redo', keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo last action', category: 'editing' },
  { id: 'copy', keys: 'Ctrl/Cmd + C', description: 'Copy selected nodes', category: 'editing' },
  { id: 'paste', keys: 'Ctrl/Cmd + V', description: 'Paste copied nodes', category: 'editing' },
  { id: 'delete', keys: 'Delete / Backspace', description: 'Delete selected nodes', category: 'editing' },
  { id: 'duplicate', keys: 'Ctrl/Cmd + D', description: 'Duplicate selected node', category: 'editing' },
  { id: 'quick-add', keys: 'Tab', description: 'Quick add node after selected', category: 'editing' },

  // Selection
  { id: 'select-all', keys: 'Ctrl/Cmd + A', description: 'Select all nodes', category: 'selection' },
  { id: 'multi-select', keys: 'Shift + Click', description: 'Add/remove from selection', category: 'selection' },
  { id: 'deselect', keys: 'Escape', description: 'Deselect all', category: 'selection' },

  // View
  { id: 'zoom-in', keys: 'Ctrl/Cmd + +', description: 'Zoom in', category: 'view' },
  { id: 'zoom-out', keys: 'Ctrl/Cmd + -', description: 'Zoom out', category: 'view' },
  { id: 'zoom-fit', keys: 'Ctrl/Cmd + 0', description: 'Fit view to content', category: 'view' },
  { id: 'zoom-100', keys: 'Ctrl/Cmd + 1', description: 'Zoom to 100%', category: 'view' },

  // Navigation
  { id: 'pan', keys: 'Space + Drag', description: 'Pan canvas', category: 'navigation' },
  { id: 'sidebar-search', keys: 'Ctrl/Cmd + F', description: 'Focus sidebar search', category: 'navigation' },
];

// ============================================================================
// Hook
// ============================================================================

export interface UseKeyboardShortcutsOptions {
  onShowHelp?: () => void;
  onFocusSearch?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onShowHelp, onFocusSearch, enabled = true } = options;

  const reactFlow = useReactFlow();

  // Store actions
  const undo = useWorkflowBuilderStore(state => state.undo);
  const redo = useWorkflowBuilderStore(state => state.redo);
  const canUndo = useWorkflowBuilderStore(state => state.canUndo);
  const canRedo = useWorkflowBuilderStore(state => state.canRedo);
  const selectedNodeId = useWorkflowBuilderStore(state => state.selectedNodeId);
  const selectNode = useWorkflowBuilderStore(state => state.selectNode);
  const deleteNode = useWorkflowBuilderStore(state => state.deleteNode);
  const duplicateNode = useWorkflowBuilderStore(state => state.duplicateNode);
  const nodes = useWorkflowBuilderStore(state => state.nodes);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Check if we're in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // ? - Show help (always works)
      if (e.key === '?' && !modKey && !e.altKey) {
        e.preventDefault();
        onShowHelp?.();
        return;
      }

      // Skip other shortcuts if in input field
      if (isInputField) return;

      // Ctrl/Cmd + S - Save
      if (modKey && e.key === 's') {
        e.preventDefault();
        // Save is handled by toolbar, this just prevents browser save dialog
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if (modKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z - Redo
      if (modKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      // Ctrl/Cmd + Y - Redo (alternative)
      if (modKey && e.key === 'y') {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      // Delete/Backspace - Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      // Ctrl/Cmd + D - Duplicate selected node
      if (modKey && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
        return;
      }

      // Ctrl/Cmd + A - Select all nodes
      if (modKey && e.key === 'a') {
        e.preventDefault();
        // React Flow handles multi-select, we just select the first node
        if (nodes.length > 0) {
          selectNode(nodes[0].id);
        }
        return;
      }

      // Escape - Deselect all
      if (e.key === 'Escape') {
        e.preventDefault();
        selectNode(null);
        return;
      }

      // Ctrl/Cmd + + - Zoom in
      if (modKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        reactFlow.zoomIn({ duration: 200 });
        return;
      }

      // Ctrl/Cmd + - - Zoom out
      if (modKey && e.key === '-') {
        e.preventDefault();
        reactFlow.zoomOut({ duration: 200 });
        return;
      }

      // Ctrl/Cmd + 0 - Fit view
      if (modKey && e.key === '0') {
        e.preventDefault();
        reactFlow.fitView({ padding: 0.2, duration: 200 });
        return;
      }

      // Ctrl/Cmd + 1 - Zoom to 100%
      if (modKey && e.key === '1') {
        e.preventDefault();
        reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
        return;
      }

      // Ctrl/Cmd + K - Focus search
      if (modKey && e.key === 'k') {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }
    },
    [
      enabled,
      onShowHelp,
      onFocusSearch,
      undo,
      redo,
      canUndo,
      canRedo,
      selectedNodeId,
      selectNode,
      deleteNode,
      duplicateNode,
      nodes,
      reactFlow,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts: SHORTCUT_DEFINITIONS };
}
