import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Panel, Group, useDefaultLayout } from 'react-resizable-panels';
import type { WorkflowDefinitionInput } from '../types';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import { BuilderCanvas } from './builder-canvas';
import { BuilderToolbar } from './builder-toolbar';
import { BuilderSidebar } from './builder-sidebar';
import { PropertiesPanel } from './properties-panel';
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-panel';
import { CommandPalette } from './command-palette';
import { ErrorBoundary, CanvasErrorBoundary, PanelErrorBoundary } from './error-boundary';
import { PanelSeparator } from '@/lib/resize/separator';

import '@xyflow/react/dist/style.css';

export interface WorkflowBuilderProps {
  definition: WorkflowDefinitionInput;
  workflowId: string;
}

export function WorkflowBuilder({ definition }: WorkflowBuilderProps) {
  const loadedRef = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Resizable panel layout persistence
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: 'workflow-builder-layout',
    storage: localStorage,
  });

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeCommandPalette = useCallback(() => setShowCommandPalette(false), []);

  // Load definition on mount - only once
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    console.log('[WorkflowBuilder] Loading definition:', definition);
    useWorkflowBuilderStore.getState().loadFromDefinition(definition);

    // Cleanup on unmount
    return () => {
      console.log('[WorkflowBuilder] Cleanup - resetting store');
      useWorkflowBuilderStore.getState().reset();
    };
  }, [definition]);

  return (
    <ErrorBoundary context="Workflow Builder">
      <ReactFlowProvider>
        <div className="h-screen flex flex-col bg-surface1">
          {/* Top toolbar */}
          <BuilderToolbar onShowShortcuts={() => setShowShortcuts(true)} />

          {/* Main content area with resizable panels */}
          <Group className="flex-1 overflow-hidden" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
            {/* Left sidebar - step palette (fixed width) */}
            <Panel id="sidebar" defaultSize={240} minSize={200} maxSize={320}>
              <BuilderSidebar className="h-full border-r border-border1 bg-surface2" />
            </Panel>

            <PanelSeparator />

            {/* Center - canvas */}
            <Panel id="canvas" minSize={400}>
              <CanvasErrorBoundary>
                <BuilderCanvas className="h-full" />
              </CanvasErrorBoundary>
            </Panel>

            <PanelSeparator />

            {/* Right panel - properties (resizable) */}
            <Panel id="properties" defaultSize={320} minSize={280} maxSize={500}>
              <PanelErrorBoundary>
                <PropertiesPanel className="h-full border-l border-border1 bg-surface2" />
              </PanelErrorBoundary>
            </Panel>
          </Group>

          {/* Keyboard shortcuts modal */}
          <KeyboardShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

          {/* Command palette */}
          <CommandPalette isOpen={showCommandPalette} onClose={closeCommandPalette} />
        </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
