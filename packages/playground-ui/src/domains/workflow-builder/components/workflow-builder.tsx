import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Panel, Group, useDefaultLayout } from 'react-resizable-panels';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import type { WorkflowDefinitionInput } from '../types';
import { useWorkflowBuilderStore, selectDeserializationError } from '../store/workflow-builder-store';
import { useTestRunnerStore } from '../store/test-runner-store';
import { BuilderCanvas } from './builder-canvas';
import { BuilderToolbar } from './builder-toolbar';
import { BuilderSidebar } from './builder-sidebar';
import { PropertiesPanel } from './properties-panel';
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-panel';
import { CommandPalette } from './command-palette';
import { TestRunnerPanel } from './test-runner-panel';
import { TestInputModal } from './test-input-modal';
import { ErrorBoundary, CanvasErrorBoundary, PanelErrorBoundary } from './error-boundary';
import { PanelSeparator } from '@/lib/resize/separator';
import { useTestWorkflow } from '../hooks/use-test-workflow';
import { toast } from '@/lib/toast';

import '@xyflow/react/dist/style.css';

export interface WorkflowBuilderProps {
  definition: WorkflowDefinitionInput;
  workflowId: string;
}

export function WorkflowBuilder({ definition }: WorkflowBuilderProps) {
  const loadedRef = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);

  // Test runner
  const { runTest, resumeTest } = useTestWorkflow();
  const isTestRunnerOpen = useTestRunnerStore(state => state.isOpen);
  const currentRun = useTestRunnerStore(state => state.currentRun);
  const isResume = currentRun?.status === 'suspended';

  // Deserialization error handling
  const deserializationError = useWorkflowBuilderStore(selectDeserializationError);
  const clearDeserializationError = useWorkflowBuilderStore(state => state.clearDeserializationError);

  // Resizable panel layout persistence
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: 'workflow-builder-layout',
    storage: localStorage,
  });

  // Keyboard shortcuts callback
  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  // Command palette and shortcuts keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      // Keyboard shortcuts help: ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't trigger if in an input field
        const target = e.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInputField) {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show toast when deserialization error occurs
  useEffect(() => {
    if (deserializationError) {
      toast.error('Workflow Load Error', {
        description: deserializationError,
        duration: 10000,
      });
      clearDeserializationError();
    }
  }, [deserializationError, clearDeserializationError]);

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
          <BuilderToolbar onShowShortcuts={handleShowShortcuts} />

          {/* Main content area with resizable panels */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left sidebar - step palette (collapsible) */}
            <div
              className={`h-full border-r border-border1 bg-surface2 transition-all duration-150 ${
                sidebarCollapsed ? 'w-10' : 'w-60'
              }`}
            >
              {sidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="w-full h-10 flex items-center justify-center hover:bg-surface3"
                  title="Expand sidebar"
                >
                  <PanelRightClose className="w-4 h-4 text-icon4" />
                </button>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border1">
                    <span className="text-xs font-medium text-icon5">Steps</span>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1 hover:bg-surface3 rounded"
                      title="Collapse sidebar"
                    >
                      <PanelLeftClose className="w-4 h-4 text-icon4" />
                    </button>
                  </div>
                  <BuilderSidebar className="flex-1 overflow-y-auto" />
                </div>
              )}
            </div>

            {/* Center - canvas (flexible) */}
            <div className="flex-1 min-w-0">
              <CanvasErrorBoundary>
                <BuilderCanvas className="h-full" />
              </CanvasErrorBoundary>
            </div>

            {/* Right panel - properties (collapsible, wider) */}
            <div
              className={`h-full border-l border-border1 bg-surface2 transition-all duration-150 ${
                propertiesCollapsed ? 'w-10' : 'w-96'
              }`}
            >
              {propertiesCollapsed ? (
                <button
                  type="button"
                  onClick={() => setPropertiesCollapsed(false)}
                  className="w-full h-10 flex items-center justify-center hover:bg-surface3"
                  title="Expand properties"
                >
                  <PanelLeftClose className="w-4 h-4 text-icon4" />
                </button>
              ) : (
                <PanelErrorBoundary>
                  <PropertiesPanel className="h-full" onCollapse={() => setPropertiesCollapsed(true)} />
                </PanelErrorBoundary>
              )}
            </div>

            {/* Test runner panel - slides in from right */}
            {isTestRunnerOpen && <TestRunnerPanel className="h-full" />}
          </div>

          {/* Keyboard shortcuts modal */}
          <KeyboardShortcutsPanel isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

          {/* Command palette */}
          <CommandPalette isOpen={showCommandPalette} onClose={closeCommandPalette} />

          {/* Test input modal */}
          <TestInputModal
            onRun={isResume ? resumeTest : runTest}
            isResume={isResume}
            resumeSchema={currentRun?.suspend?.resumeSchema}
          />
        </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
