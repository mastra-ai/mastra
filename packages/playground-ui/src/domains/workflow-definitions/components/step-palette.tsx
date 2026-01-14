'use client';

import React, { useMemo, useState } from 'react';
import { Bot, Wrench, Workflow, ArrowRightLeft, Pause, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types for the palette
export interface StepPaletteItem {
  type: 'agent' | 'tool' | 'workflow' | 'transform' | 'suspend';
  id: string;
  name: string;
  description?: string;
  source: 'code' | 'stored';
}

export interface StepPaletteProps {
  agents?: Array<{ id: string; name: string; description?: string; source?: 'code' | 'stored' }>;
  tools?: Array<{ id: string; name: string; description?: string }>;
  workflows?: Array<{ id: string; name: string; description?: string; source?: 'code' | 'stored' }>;
  onSelectStep: (step: StepPaletteItem) => void;
  className?: string;
}

const typeConfig = {
  agent: { label: 'Agents', icon: Bot, color: 'text-blue-500' },
  tool: { label: 'Tools', icon: Wrench, color: 'text-green-500' },
  workflow: { label: 'Workflows', icon: Workflow, color: 'text-purple-500' },
  transform: { label: 'Transform', icon: ArrowRightLeft, color: 'text-orange-500' },
  suspend: { label: 'Control Flow', icon: Pause, color: 'text-pink-500' },
};

export function StepPalette({
  agents = [],
  tools = [],
  workflows = [],
  onSelectStep,
  className = '',
}: StepPaletteProps) {
  const [search, setSearch] = useState('');

  // Build list of all available steps
  const items = useMemo(() => {
    const result: StepPaletteItem[] = [];

    // Add agents
    agents.forEach(agent => {
      result.push({
        type: 'agent',
        id: agent.id,
        name: agent.name || agent.id,
        description: agent.description,
        source: agent.source || 'code',
      });
    });

    // Add tools
    tools.forEach(tool => {
      result.push({
        type: 'tool',
        id: tool.id,
        name: tool.name || tool.id,
        description: tool.description,
        source: 'code',
      });
    });

    // Add workflows
    workflows.forEach(workflow => {
      result.push({
        type: 'workflow',
        id: workflow.id,
        name: workflow.name || workflow.id,
        description: workflow.description,
        source: workflow.source || 'code',
      });
    });

    // Add built-in step types
    result.push({
      type: 'transform',
      id: '__transform__',
      name: 'Transform',
      description: 'Transform and map data between steps',
      source: 'code',
    });

    result.push({
      type: 'suspend',
      id: '__suspend__',
      name: 'Suspend',
      description: 'Pause workflow and wait for external input',
      source: 'code',
    });

    return result;
  }, [agents, tools, workflows]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const lower = search.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower) ||
        item.id.toLowerCase().includes(lower),
    );
  }, [items, search]);

  // Group by type
  const groupedItems = useMemo(() => {
    const groups: Record<StepPaletteItem['type'], StepPaletteItem[]> = {
      agent: [],
      tool: [],
      workflow: [],
      transform: [],
      suspend: [],
    };
    filteredItems.forEach(item => {
      groups[item.type].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <div className={cn('flex flex-col h-full bg-surface1', className)}>
      {/* Search */}
      <div className="p-3 border-b border-border1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-icon3" />
          <input
            type="text"
            placeholder="Search steps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border1 bg-surface2 text-icon6 placeholder:text-icon3 focus:outline-none focus:ring-2 focus:ring-accent1"
          />
        </div>
      </div>

      {/* Step list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {Object.entries(groupedItems).map(([type, typeItems]) => {
            if (typeItems.length === 0) return null;

            const config = typeConfig[type as StepPaletteItem['type']];
            const Icon = config.icon;

            return (
              <div key={type}>
                <h3 className="text-xs font-semibold text-icon3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5', config.color)} />
                  {config.label}
                </h3>
                <div className="space-y-1">
                  {typeItems.map(item => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => onSelectStep(item)}
                      className="w-full text-left p-2 rounded-md hover:bg-surface3 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-icon6 group-hover:text-icon5">{item.name}</span>
                        {item.source === 'stored' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface3 text-icon3">stored</span>
                        )}
                      </div>
                      {item.description && <p className="text-xs text-icon3 mt-0.5 line-clamp-2">{item.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-icon3 text-sm">No steps found matching "{search}"</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
