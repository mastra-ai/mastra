import { useEffect, useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, Plus, AlertCircle, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { useTestRunnerStore } from '../../store/test-runner-store';
import { QuickAddPopover } from '../quick-add-popover';
import { StepStatusOverlay } from './step-status-overlay';
import { NodeComment } from './node-comment';
import type { BuilderNodeType } from '../../types';
import { getIssuesForNode, hasErrorsForNode, hasWarningsForNode } from '../../utils/validate';

export interface BaseNodeProps {
  id: string;
  selected?: boolean;
  children: React.ReactNode;
  hasTopHandle?: boolean;
  hasBottomHandle?: boolean;
  bottomHandleCount?: number;
  accentColor?: string;
  /** Whether to show the quick-add button (defaults to true if hasBottomHandle) */
  showQuickAdd?: boolean;
  /** Node types to exclude from quick-add menu */
  quickAddExcludeTypes?: BuilderNodeType[];
  /** Comment/annotation for this node */
  comment?: string;
  /** Whether to show the comment button (defaults to true) */
  showComment?: boolean;
}

export function BaseNode({
  id,
  selected = false,
  children,
  hasTopHandle = true,
  hasBottomHandle = true,
  bottomHandleCount = 1,
  accentColor,
  showQuickAdd = true,
  quickAddExcludeTypes = [],
  comment,
  showComment = true,
}: BaseNodeProps) {
  const deleteNode = useWorkflowBuilderStore(state => state.deleteNode);
  const addConnectedNode = useWorkflowBuilderStore(state => state.addConnectedNode);
  const quickAddTargetNodeId = useWorkflowBuilderStore(state => state.quickAddTargetNodeId);
  const triggerQuickAdd = useWorkflowBuilderStore(state => state.triggerQuickAdd);
  const validationResult = useWorkflowBuilderStore(state => state.validationResult);
  const selectedNodeIds = useWorkflowBuilderStore(state => state.selectedNodeIds);

  // Check if this node is part of a multi-selection
  const isInMultiSelect = selectedNodeIds.size > 1 && selectedNodeIds.has(id);

  // Test runner state
  const currentRun = useTestRunnerStore(state => state.currentRun);
  const isTestRunning = useTestRunnerStore(state => state.isRunning);
  const hasStepResult = currentRun?.steps[id] !== undefined;

  // Compute validation state for this node
  const nodeValidation = useMemo(() => {
    if (!validationResult) return { hasErrors: false, hasWarnings: false, issues: [] };
    return {
      hasErrors: hasErrorsForNode(validationResult, id),
      hasWarnings: hasWarningsForNode(validationResult, id),
      issues: getIssuesForNode(validationResult, id),
    };
  }, [validationResult, id]);

  // Local state for controlling the popover
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Listen for keyboard-triggered quick-add from the store
  useEffect(() => {
    if (quickAddTargetNodeId === id && hasBottomHandle && showQuickAdd) {
      setIsQuickAddOpen(true);
      // Clear the trigger so it doesn't re-open on re-renders
      triggerQuickAdd(null);
    }
  }, [quickAddTargetNodeId, id, hasBottomHandle, showQuickAdd, triggerQuickAdd]);

  const handleQuickAdd = (type: BuilderNodeType) => {
    addConnectedNode(id, type);
    setIsQuickAddOpen(false);
  };

  return (
    <>
      {hasTopHandle && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-border1 !border-2 !border-surface3" />
      )}

      <div
        className={cn(
          'bg-surface3 rounded-lg w-[274px] border-sm relative group',
          'transition-all duration-150 ease-out',
          'hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5',
          selected ? 'border-accent1 ring-2 ring-accent1/20' : 'border-border1',
          // Multi-select state - cyan highlight
          isInMultiSelect && 'ring-2 ring-cyan-500/40 border-cyan-500',
          accentColor && 'border-l-4',
          // Validation error/warning styles
          nodeValidation.hasErrors && 'border-red-500 ring-2 ring-red-500/20',
          nodeValidation.hasWarnings && !nodeValidation.hasErrors && 'border-amber-500 ring-2 ring-amber-500/20',
        )}
        style={accentColor ? { borderLeftColor: accentColor } : undefined}
      >
        {/* Visually hidden text for screen readers announcing selection state */}
        <span className="sr-only">
          {selected ? 'Selected node.' : ''} {isInMultiSelect ? 'Part of multi-selection.' : ''}{' '}
          {nodeValidation.hasErrors
            ? `Has ${nodeValidation.issues.length} validation error${nodeValidation.issues.length > 1 ? 's' : ''}.`
            : nodeValidation.hasWarnings
              ? `Has ${nodeValidation.issues.length} validation warning${nodeValidation.issues.length > 1 ? 's' : ''}.`
              : ''}
        </span>

        {/* Multi-select indicator - top left */}
        {isInMultiSelect && !nodeValidation.hasErrors && !nodeValidation.hasWarnings && (
          <div
            className={cn(
              'absolute -top-2 -left-2 z-10',
              'w-5 h-5 rounded-full',
              'bg-cyan-500 flex items-center justify-center',
              'animate-in fade-in zoom-in duration-150',
            )}
            aria-hidden="true"
          >
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Validation indicator - top left */}
        {(nodeValidation.hasErrors || nodeValidation.hasWarnings) && (
          <div
            className={cn(
              'absolute -top-2 -left-2 z-10',
              'w-5 h-5 rounded-full',
              'flex items-center justify-center',
              nodeValidation.hasErrors ? 'bg-red-500' : 'bg-amber-500',
            )}
            title={nodeValidation.issues.map(i => i.message).join('\n')}
            aria-hidden="true"
          >
            {nodeValidation.hasErrors ? (
              <AlertCircle className="w-3 h-3 text-white" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-white" />
            )}
          </div>
        )}

        {/* Delete button - visible on hover (hidden during test run) */}
        {!isTestRunning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    deleteNode(id);
                  }}
                  className={cn(
                    'absolute -top-2 -right-2 z-10',
                    'w-5 h-5 rounded-full',
                    'bg-red-500 hover:bg-red-600 hover:scale-110',
                    'flex items-center justify-center',
                    'opacity-0 group-hover:opacity-100',
                    'transition-all duration-150 ease-out',
                    'text-white',
                  )}
                  aria-label="Delete node"
                >
                  <X className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Delete node</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Step status overlay (shown during/after test run) */}
        {hasStepResult && <StepStatusOverlay stepId={id} position="top-right" />}

        {/* Node comment */}
        {showComment && <NodeComment nodeId={id} comment={comment} position="top" />}

        {children}
      </div>

      {hasBottomHandle && bottomHandleCount === 1 && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-border1 !border-2 !border-surface3" />
      )}

      {hasBottomHandle &&
        bottomHandleCount > 1 &&
        Array.from({ length: bottomHandleCount }).map((_, i) => (
          <Handle
            key={`handle-${i}`}
            type="source"
            position={Position.Bottom}
            id={`branch-${i}`}
            className="!w-3 !h-3 !bg-border1 !border-2 !border-surface3"
            style={{
              left: `${((i + 1) / (bottomHandleCount + 1)) * 100}%`,
            }}
          />
        ))}

      {/* Quick-add button with popover - visible on hover, positioned below the node */}
      {hasBottomHandle && showQuickAdd && (
        <TooltipProvider>
          <Tooltip>
            <QuickAddPopover
              onSelect={handleQuickAdd}
              excludeTypes={quickAddExcludeTypes}
              open={isQuickAddOpen}
              onOpenChange={setIsQuickAddOpen}
            >
              <TooltipTrigger asChild>
                <button
                  onClick={e => {
                    e.stopPropagation();
                  }}
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 -bottom-8 z-20',
                    'w-6 h-6 rounded-full bg-accent1',
                    'hover:bg-accent1/90 hover:scale-110',
                    'flex items-center justify-center',
                    'opacity-0 group-hover:opacity-100',
                    'transition-all duration-150 ease-out',
                    'text-white shadow-lg hover:shadow-xl',
                  )}
                  aria-label="Add connected node"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </TooltipTrigger>
            </QuickAddPopover>
            <TooltipContent side="bottom">
              <p>Add step (Tab)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}
