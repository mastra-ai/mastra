import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Search,
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
} from 'lucide-react';
import type { BuilderNodeType } from '../types';

// Node type items for quick-add - comprehensive list of all node types
const NODE_TYPE_ITEMS: Array<{
  type: BuilderNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}> = [
  // Core
  {
    type: 'agent',
    label: 'Agent',
    description: 'Execute an AI agent',
    icon: <Bot className="w-4 h-4" />,
    color: '#3b82f6',
    category: 'Core',
  },
  {
    type: 'tool',
    label: 'Tool',
    description: 'Execute a tool',
    icon: <Wrench className="w-4 h-4" />,
    color: '#a855f7',
    category: 'Core',
  },
  // Flow Control
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch based on logic',
    icon: <GitBranch className="w-4 h-4" />,
    color: '#eab308',
    category: 'Flow',
  },
  {
    type: 'parallel',
    label: 'Parallel',
    description: 'Run branches concurrently',
    icon: <GitMerge className="w-4 h-4" />,
    color: '#06b6d4',
    category: 'Flow',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Repeat until condition',
    icon: <RefreshCw className="w-4 h-4" />,
    color: '#f97316',
    category: 'Flow',
  },
  {
    type: 'foreach',
    label: 'For Each',
    description: 'Iterate over collection',
    icon: <List className="w-4 h-4" />,
    color: '#ec4899',
    category: 'Flow',
  },
  // Data & State
  {
    type: 'transform',
    label: 'Transform',
    description: 'Map and transform data',
    icon: <ArrowRightLeft className="w-4 h-4" />,
    color: '#14b8a6',
    category: 'Data',
  },
  {
    type: 'workflow',
    label: 'Sub-Workflow',
    description: 'Call another workflow',
    icon: <Workflow className="w-4 h-4" />,
    color: '#6366f1',
    category: 'Data',
  },
  // Timing & Human
  {
    type: 'suspend',
    label: 'Human Input',
    description: 'Wait for human approval',
    icon: <Hand className="w-4 h-4" />,
    color: '#ef4444',
    category: 'Human',
  },
  {
    type: 'sleep',
    label: 'Sleep',
    description: 'Delay execution',
    icon: <Clock className="w-4 h-4" />,
    color: '#6b7280',
    category: 'Timing',
  },
  // AI Advanced
  {
    type: 'agent-network',
    label: 'Agent Network',
    description: 'Multi-agent collaboration',
    icon: <Network className="w-4 h-4" />,
    color: '#8b5cf6',
    category: 'AI',
  },
  // Trigger (usually excluded)
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Workflow entry point',
    icon: <PlayCircle className="w-4 h-4" />,
    color: '#22c55e',
    category: 'Core',
  },
];

export interface QuickAddPopoverProps {
  /** The trigger element (usually the + button) */
  children: React.ReactNode;
  /** Called when a node type is selected */
  onSelect: (type: BuilderNodeType) => void;
  /** Whether the popover is open (controlled) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Node types to exclude from the list */
  excludeTypes?: BuilderNodeType[];
  /** Alignment of the popover */
  align?: 'start' | 'center' | 'end';
  /** Side of the popover */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function QuickAddPopover({
  children,
  onSelect,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  excludeTypes = [],
  align = 'center',
  side = 'bottom',
}: QuickAddPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  // Filter items based on search and excluded types
  const filteredItems = React.useMemo(() => {
    let items = NODE_TYPE_ITEMS.filter(item => !excludeTypes.includes(item.type));

    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(
        item => item.label.toLowerCase().includes(searchLower) || item.description.toLowerCase().includes(searchLower),
      );
    }

    return items;
  }, [search, excludeTypes]);

  // Reset state when popover opens/closes
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightedIndex(0);
      // Focus the search input when popover opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  // Reset highlight when filtered items change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems.length]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (listRef.current && highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, filteredItems.length]);

  const handleSelect = (type: BuilderNodeType) => {
    onSelect(type);
    setOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex].type);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(filteredItems.length - 1);
        break;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align={align} side={side} sideOffset={8}>
        <div className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center border-b border-border1 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-icon3" />
            <input
              ref={inputRef}
              className="flex h-7 w-full bg-transparent text-sm placeholder:text-icon3 outline-none"
              placeholder="Search steps..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-controls="quick-add-options"
              aria-expanded={open}
            />
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            id="quick-add-options"
            role="listbox"
            className="max-h-64 overflow-y-auto overflow-x-hidden p-1"
          >
            {filteredItems.length === 0 ? (
              <div className="py-4 text-center text-sm text-icon3">No steps found</div>
            ) : (
              filteredItems.map((item, index) => {
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={item.type}
                    role="option"
                    aria-selected={isHighlighted}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer transition-colors',
                      'hover:bg-surface2',
                      isHighlighted && 'bg-surface2',
                    )}
                    onClick={() => handleSelect(item.type)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {/* Icon with color accent */}
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-md"
                      style={{ backgroundColor: `${item.color}20`, color: item.color }}
                    >
                      {item.icon}
                    </div>

                    {/* Label and description */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-icon6">{item.label}</span>
                      <span className="text-xs text-icon3 truncate">{item.description}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Keyboard hint */}
          <div className="border-t border-border1 px-3 py-2 text-xs text-icon3 flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-surface2 rounded text-[10px]">Enter</kbd>
            <span>to select</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
