import * as React from 'react';
import {
  PlayCircle,
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
  Search,
  X,
} from 'lucide-react';
import { StepItem } from './step-item';
import { cn } from '@/lib/utils';
import type { BuilderNodeType } from '../types';
import { useSearch } from '../hooks/use-search';

export interface BuilderSidebarProps {
  className?: string;
}

// Grouped step items for better organization
const STEP_GROUPS = {
  core: {
    label: 'Core',
    items: [
      {
        type: 'trigger' as const,
        label: 'Trigger',
        description: 'Workflow entry point',
        icon: <PlayCircle className="w-5 h-5" />,
        color: '#22c55e',
      },
      {
        type: 'agent' as const,
        label: 'Agent',
        description: 'Execute an AI agent',
        icon: <Bot className="w-5 h-5" />,
        color: '#3b82f6',
      },
      {
        type: 'tool' as const,
        label: 'Tool',
        description: 'Execute a tool',
        icon: <Wrench className="w-5 h-5" />,
        color: '#a855f7',
      },
    ],
  },
  flow: {
    label: 'Flow Control',
    items: [
      {
        type: 'condition' as const,
        label: 'Condition',
        description: 'Branch based on logic',
        icon: <GitBranch className="w-5 h-5" />,
        color: '#eab308',
      },
      {
        type: 'parallel' as const,
        label: 'Parallel',
        description: 'Run branches concurrently',
        icon: <GitMerge className="w-5 h-5" />,
        color: '#06b6d4',
      },
      {
        type: 'loop' as const,
        label: 'Loop',
        description: 'Repeat until condition',
        icon: <RefreshCw className="w-5 h-5" />,
        color: '#f97316',
      },
      {
        type: 'foreach' as const,
        label: 'For Each',
        description: 'Iterate over collection',
        icon: <List className="w-5 h-5" />,
        color: '#ec4899',
      },
    ],
  },
  data: {
    label: 'Data & State',
    items: [
      {
        type: 'transform' as const,
        label: 'Transform',
        description: 'Map and transform data',
        icon: <ArrowRightLeft className="w-5 h-5" />,
        color: '#14b8a6',
      },
      {
        type: 'workflow' as const,
        label: 'Sub-Workflow',
        description: 'Call another workflow',
        icon: <Workflow className="w-5 h-5" />,
        color: '#6366f1',
      },
    ],
  },
  time: {
    label: 'Timing & Human',
    items: [
      {
        type: 'suspend' as const,
        label: 'Human Input',
        description: 'Wait for human approval',
        icon: <Hand className="w-5 h-5" />,
        color: '#ef4444',
      },
      {
        type: 'sleep' as const,
        label: 'Sleep',
        description: 'Delay execution',
        icon: <Clock className="w-5 h-5" />,
        color: '#6b7280',
      },
    ],
  },
  ai: {
    label: 'AI Advanced',
    items: [
      {
        type: 'agent-network' as const,
        label: 'Agent Network',
        description: 'Multi-agent collaboration',
        icon: <Network className="w-5 h-5" />,
        color: '#8b5cf6',
      },
    ],
  },
};

// Export step items for use in quick-add popover
export type StepItemConfig = {
  type: BuilderNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

export const ALL_STEP_ITEMS: StepItemConfig[] = Object.values(STEP_GROUPS).flatMap(group =>
  group.items.map(item => ({
    type: item.type as BuilderNodeType,
    label: item.label,
    description: item.description,
    icon: item.icon,
    color: item.color,
  })),
);

export function BuilderSidebar({ className }: BuilderSidebarProps) {
  const { query, setQuery, clear, results, hasQuery } = useSearch(ALL_STEP_ITEMS, {
    keys: ['label', 'description'],
    threshold: 5,
  });

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus search on Cmd/Ctrl+F when sidebar is focused
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Only if sidebar area is focused
        const sidebar = document.querySelector('[data-sidebar]');
        if (sidebar?.contains(document.activeElement) || document.activeElement === document.body) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)} data-sidebar>
      {/* Header with search */}
      <div className="p-4 border-b border-border1 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-icon6">Steps</h2>
          <p className="text-xs text-icon3 mt-1">Drag to add to workflow</p>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-icon3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search steps..."
            className={cn(
              'w-full h-8 pl-8 pr-8 text-sm rounded-md',
              'bg-surface3 border border-border1',
              'placeholder:text-icon3 text-icon6',
              'focus:outline-none focus:ring-2 focus:ring-accent1/50 focus:border-accent1',
              'transition-all duration-150',
            )}
          />
          {hasQuery && (
            <button
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-icon3 hover:text-icon5 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Step items - filtered or grouped */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasQuery ? (
          // Show flat filtered results when searching
          results.length === 0 ? (
            <div className="text-center py-8 text-icon3 text-sm">No steps match "{query}"</div>
          ) : (
            <div className="space-y-1">
              {results.map(({ item }) => (
                <StepItem
                  key={item.type}
                  type={item.type}
                  label={item.label}
                  description={item.description}
                  icon={item.icon}
                  color={item.color}
                />
              ))}
            </div>
          )
        ) : (
          // Show grouped items when not searching
          Object.entries(STEP_GROUPS).map(([key, group]) => (
            <div key={key}>
              <div className="text-xs font-medium text-icon3 mb-2 uppercase tracking-wide">{group.label}</div>
              <div className="space-y-1">
                {group.items.map(item => (
                  <StepItem
                    key={item.type}
                    type={item.type}
                    label={item.label}
                    description={item.description}
                    icon={item.icon}
                    color={item.color}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
