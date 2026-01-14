import { Workflow, Plus, Sparkles, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

export interface EmptyStateProps {
  className?: string;
}

/**
 * Empty state shown when the canvas has no nodes (except trigger).
 * Provides helpful guidance for new users.
 */
export function EmptyState({ className }: EmptyStateProps) {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const addNode = useWorkflowBuilderStore(state => state.addNode);

  // Don't show if there are non-trigger nodes
  const hasNonTriggerNodes = nodes.some(n => n.data.type !== 'trigger');
  if (hasNonTriggerNodes) return null;

  // Find trigger node to position the first node
  const triggerNode = nodes.find(n => n.data.type === 'trigger');

  const handleAddAgent = () => {
    const position = triggerNode ? { x: triggerNode.position.x, y: triggerNode.position.y + 150 } : { x: 400, y: 200 };
    addNode('agent', position);
  };

  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', 'pointer-events-none z-10', className)}>
      <div className="pointer-events-auto max-w-md text-center p-8">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-accent1/10 flex items-center justify-center mx-auto mb-6">
          <Workflow className="w-8 h-8 text-accent1" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-icon6 mb-2">Build Your Workflow</h2>

        {/* Description */}
        <p className="text-sm text-icon4 mb-6">
          Add steps to create your AI workflow. Drag nodes from the sidebar or use the quick actions below.
        </p>

        {/* Quick actions */}
        <div className="space-y-3">
          <button
            onClick={handleAddAgent}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg',
              'bg-accent1/10 hover:bg-accent1/20 border border-accent1/20',
              'transition-all duration-150',
              'group',
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-icon6 group-hover:text-accent1 transition-colors">
                Add an Agent
              </div>
              <div className="text-xs text-icon4">Start with an AI agent step</div>
            </div>
            <Plus className="w-5 h-5 text-icon3 group-hover:text-accent1 transition-colors" />
          </button>
        </div>

        {/* Hints */}
        <div className="mt-8 pt-6 border-t border-border1">
          <div className="flex items-center justify-center gap-6 text-xs text-icon3">
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" />
              <span>Drag from sidebar</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface3 rounded text-[10px]">⌘K</kbd>
              <span>Command palette</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface3 rounded text-[10px]">Tab</kbd>
              <span>Quick add</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
