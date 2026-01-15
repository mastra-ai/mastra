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
  category: 'navigation' | 'editing' | 'selection' | 'view' | 'general' | 'canvas';
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
  // Selection
  { id: 'click-select', keys: 'Click', description: 'Select node', category: 'selection' },
  { id: 'multi-select', keys: 'Shift + Click', description: 'Multi-select', category: 'selection' },
  { id: 'select-all', keys: 'Ctrl/Cmd + A', description: 'Select all', category: 'selection' },
  { id: 'deselect', keys: 'Escape', description: 'Clear selection', category: 'selection' },

  // Editing
  { id: 'delete', keys: 'Delete / Backspace', description: 'Delete selected', category: 'editing' },
  { id: 'copy', keys: 'Ctrl/Cmd + C', description: 'Copy selected', category: 'editing' },
  { id: 'paste', keys: 'Ctrl/Cmd + V', description: 'Paste', category: 'editing' },
  { id: 'undo', keys: 'Ctrl/Cmd + Z', description: 'Undo', category: 'editing' },
  { id: 'redo', keys: 'Ctrl/Cmd + Shift + Z', description: 'Redo', category: 'editing' },

  // Navigation
  { id: 'quick-add', keys: 'Tab', description: 'Quick add after selected node', category: 'navigation' },
  { id: 'command-palette', keys: 'Ctrl/Cmd + K', description: 'Command palette', category: 'navigation' },
  { id: 'help', keys: '?', description: 'Show this help', category: 'navigation' },

  // Canvas
  { id: 'scroll-zoom', keys: 'Scroll', description: 'Zoom', category: 'canvas' },
  { id: 'drag-pan', keys: 'Drag', description: 'Pan canvas', category: 'canvas' },
  { id: 'drag-select', keys: 'Drag selection', description: 'Box select', category: 'canvas' },
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
