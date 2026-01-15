import { Workflow, Plus, Sparkles, MousePointerClick, Wrench, GitBranch, ArrowRightLeft, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import type { BuilderNodeType } from '../types';

export interface EmptyStateProps {
  className?: string;
}

/**
 * Quick action button configuration
 */
interface QuickAction {
  type: BuilderNodeType;
  label: string;
  description: string;
  icon: typeof Bot;
  iconColor: string;
  bgColor: string;
  featured?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    type: 'agent',
    label: 'Add an Agent',
    description: 'Start with an AI agent step',
    icon: Bot,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    featured: true,
  },
  {
    type: 'tool',
    label: 'Add a Tool',
    description: 'Call an external API or function',
    icon: Wrench,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  {
    type: 'condition',
    label: 'Add a Condition',
    description: 'Branch based on data',
    icon: GitBranch,
    iconColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  {
    type: 'transform',
    label: 'Add a Transform',
    description: 'Shape and transform data',
    icon: ArrowRightLeft,
    iconColor: 'text-teal-400',
    bgColor: 'bg-teal-500/20',
  },
];

/**
 * Empty state shown when the canvas has no nodes (except trigger).
 * Provides helpful guidance for new users.
 */
export function EmptyState({ className }: EmptyStateProps) {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const addNode = useWorkflowBuilderStore(state => state.addNode);

  // Find trigger node to position the first node
  const triggerNode = nodes.find(n => n.data.type === 'trigger');

  // Don't show if there are any nodes - the overlay blocks interaction with the trigger
  // Users can use Tab on trigger, ⌘K, or drag from sidebar to add nodes
  if (nodes.length > 0) return null;

  const handleAddNode = (type: BuilderNodeType) => {
    const position = triggerNode ? { x: triggerNode.position.x, y: triggerNode.position.y + 150 } : { x: 400, y: 200 };
    addNode(type, position);
  };

  // Separate featured and secondary actions
  const featuredAction = QUICK_ACTIONS.find(a => a.featured);
  const secondaryActions = QUICK_ACTIONS.filter(a => !a.featured);

  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', 'pointer-events-none z-10', className)}>
      <div className="pointer-events-auto max-w-lg text-center p-8">
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

        {/* Featured Action */}
        {featuredAction && (
          <button
            type="button"
            onClick={() => handleAddNode(featuredAction.type)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg mb-4',
              'bg-accent1/10 hover:bg-accent1/20 border border-accent1/20',
              'transition-all duration-150',
              'group',
            )}
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', featuredAction.bgColor)}>
              <featuredAction.icon className={cn('w-5 h-5', featuredAction.iconColor)} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-icon6 group-hover:text-accent1 transition-colors">
                {featuredAction.label}
              </div>
              <div className="text-xs text-icon4">{featuredAction.description}</div>
            </div>
            <Plus className="w-5 h-5 text-icon3 group-hover:text-accent1 transition-colors" />
          </button>
        )}

        {/* Secondary Actions Grid */}
        <div className="grid grid-cols-3 gap-2">
          {secondaryActions.map(action => (
            <button
              key={action.type}
              type="button"
              onClick={() => handleAddNode(action.type)}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg',
                'bg-surface3/50 hover:bg-surface3 border border-transparent hover:border-border1',
                'transition-all duration-150',
                'group',
              )}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', action.bgColor)}>
                <action.icon className={cn('w-4 h-4', action.iconColor)} />
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-icon5 group-hover:text-icon6 transition-colors">
                  {action.label.replace('Add a ', '').replace('Add an ', '')}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Hints */}
        <div className="mt-8 pt-6 border-t border-border1">
          <div className="flex items-center justify-center gap-6 text-xs text-icon3">
            <div className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" />
              <span>Drag from sidebar</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-surface3 rounded text-[10px]">Cmd+K</kbd>
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
