import * as React from 'react';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  Bot,
  Wrench,
  GitBranch,
  GitMerge,
  RefreshCw,
  List,
  ArrowRightLeft,
  Hand,
  Workflow,
  Clock,
  Network,
  Undo2,
  Redo2,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  Copy,
  Search,
  Command,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import type { BuilderNodeType } from '../types';
import { useSearch } from '../hooks/use-search';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'node' | 'action' | 'view';
  shortcut?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// Focus trap hook for modal accessibility
function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return containerRef;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const titleId = 'command-palette-title';

  const reactFlow = useReactFlow();
  const addNode = useWorkflowBuilderStore(state => state.addNode);
  const undo = useWorkflowBuilderStore(state => state.undo);
  const redo = useWorkflowBuilderStore(state => state.redo);
  const canUndo = useWorkflowBuilderStore(state => state.canUndo);
  const canRedo = useWorkflowBuilderStore(state => state.canRedo);
  const selectedNodeId = useWorkflowBuilderStore(state => state.selectedNodeId);
  const deleteNode = useWorkflowBuilderStore(state => state.deleteNode);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const addNodeCommand = (type: BuilderNodeType, label: string, icon: React.ReactNode): CommandItem => ({
      id: `add-${type}`,
      label: `Add ${label}`,
      description: `Add a new ${label.toLowerCase()} node`,
      icon,
      category: 'node',
      action: () => {
        const center = reactFlow.getViewport();
        const position = reactFlow.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        addNode(type, position);
        onClose();
      },
    });

    return [
      // Node commands
      addNodeCommand('agent', 'Agent', <Bot className="w-4 h-4" />),
      addNodeCommand('tool', 'Tool', <Wrench className="w-4 h-4" />),
      addNodeCommand('condition', 'Condition', <GitBranch className="w-4 h-4" />),
      addNodeCommand('parallel', 'Parallel', <GitMerge className="w-4 h-4" />),
      addNodeCommand('loop', 'Loop', <RefreshCw className="w-4 h-4" />),
      addNodeCommand('foreach', 'For Each', <List className="w-4 h-4" />),
      addNodeCommand('transform', 'Transform', <ArrowRightLeft className="w-4 h-4" />),
      addNodeCommand('workflow', 'Sub-Workflow', <Workflow className="w-4 h-4" />),
      addNodeCommand('suspend', 'Human Input', <Hand className="w-4 h-4" />),
      addNodeCommand('sleep', 'Sleep', <Clock className="w-4 h-4" />),
      addNodeCommand('agent-network', 'Agent Network', <Network className="w-4 h-4" />),

      // Action commands
      {
        id: 'undo',
        label: 'Undo',
        description: 'Undo last action',
        icon: <Undo2 className="w-4 h-4" />,
        category: 'action',
        shortcut: '⌘Z',
        action: () => {
          if (canUndo()) undo();
          onClose();
        },
      },
      {
        id: 'redo',
        label: 'Redo',
        description: 'Redo last action',
        icon: <Redo2 className="w-4 h-4" />,
        category: 'action',
        shortcut: '⌘⇧Z',
        action: () => {
          if (canRedo()) redo();
          onClose();
        },
      },
      {
        id: 'delete-selected',
        label: 'Delete Selected',
        description: 'Delete the selected node',
        icon: <Trash2 className="w-4 h-4" />,
        category: 'action',
        shortcut: '⌫',
        action: () => {
          if (selectedNodeId) deleteNode(selectedNodeId);
          onClose();
        },
      },

      // View commands
      {
        id: 'zoom-in',
        label: 'Zoom In',
        description: 'Zoom in on the canvas',
        icon: <ZoomIn className="w-4 h-4" />,
        category: 'view',
        shortcut: '⌘+',
        action: () => {
          reactFlow.zoomIn();
          onClose();
        },
      },
      {
        id: 'zoom-out',
        label: 'Zoom Out',
        description: 'Zoom out on the canvas',
        icon: <ZoomOut className="w-4 h-4" />,
        category: 'view',
        shortcut: '⌘-',
        action: () => {
          reactFlow.zoomOut();
          onClose();
        },
      },
      {
        id: 'fit-view',
        label: 'Fit to View',
        description: 'Fit all nodes in view',
        icon: <Maximize className="w-4 h-4" />,
        category: 'view',
        shortcut: '⌘0',
        action: () => {
          reactFlow.fitView({ padding: 0.2 });
          onClose();
        },
      },
    ];
  }, [reactFlow, addNode, undo, redo, canUndo, canRedo, selectedNodeId, deleteNode, onClose]);

  // Search
  const { query, setQuery, results, hasQuery } = useSearch(commands, {
    keys: ['label', 'description'],
    threshold: 5,
  });

  const filteredCommands = hasQuery ? results.map(r => r.item) : commands;

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, setQuery]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCommands.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          filteredCommands[highlightedIndex]?.action();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, highlightedIndex, onClose],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = { node: [], action: [], view: [] };
    for (const cmd of filteredCommands) {
      groups[cmd.category]?.push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    node: 'Add Node',
    action: 'Actions',
    view: 'View',
  };

  // Flatten for indexing
  let currentIndex = 0;
  const getIndex = () => currentIndex++;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} aria-hidden="true" />

      {/* Palette */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
      >
        <div className="bg-surface2 border border-border1 rounded-lg shadow-2xl overflow-hidden">
          {/* Search input */}
          <h2 id={titleId} className="sr-only">
            Command Palette
          </h2>
          <div className="flex items-center border-b border-border1 px-4 py-3">
            <Search className="w-5 h-5 text-icon3 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-icon6 placeholder:text-icon3 outline-none text-sm"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-surface3 rounded text-xs text-icon3">
              <Command className="w-3 h-3" />K
            </kbd>
          </div>

          {/* Command list */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-sm text-icon3">No commands found</div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={category} className="mb-2 last:mb-0">
                    <div className="px-2 py-1 text-xs font-medium text-icon3 uppercase tracking-wide">
                      {categoryLabels[category]}
                    </div>
                    {items.map(cmd => {
                      const index = getIndex();
                      const isHighlighted = index === highlightedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left',
                            'transition-colors duration-150',
                            isHighlighted ? 'bg-accent1/20 text-accent1' : 'text-icon5 hover:bg-surface3',
                          )}
                        >
                          <span className={cn('flex-shrink-0', isHighlighted ? 'text-accent1' : 'text-icon4')}>
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{cmd.label}</div>
                            {cmd.description && <div className="text-xs text-icon3 truncate">{cmd.description}</div>}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="flex-shrink-0 px-1.5 py-0.5 bg-surface3 rounded text-[10px] text-icon3">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hints */}
          <div className="border-t border-border1 px-4 py-2 flex items-center gap-4 text-xs text-icon3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-surface3 rounded">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-surface3 rounded">↵</kbd> select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-surface3 rounded">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
