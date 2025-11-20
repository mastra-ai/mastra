'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Combobox } from '@/components/ui/combobox';
import { useTools } from '../hooks/use-all-tools';
import { useAgents } from '../../agents/hooks/use-agents';
import { useLinkComponent } from '@/lib/framework';

export interface ToolComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  buttonClassName?: string;
  contentClassName?: string;
}

export function ToolCombobox({
  value,
  onValueChange,
  placeholder = 'Select a tool...',
  searchPlaceholder = 'Search tools...',
  emptyText = 'No tools found.',
  className,
  disabled = false,
  buttonClassName = 'h-8',
  contentClassName,
}: ToolComboboxProps) {
  const { data: tools = {}, isLoading: isLoadingTools, isError: isErrorTools, error: errorTools } = useTools();
  const { data: agents = {}, isLoading: isLoadingAgents, isError: isErrorAgents, error: errorAgents } = useAgents();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isErrorTools) {
      const errorMessage = errorTools instanceof Error ? errorTools.message : 'Failed to load tools';
      toast.error(`Error loading tools: ${errorMessage}`);
    }
  }, [isErrorTools, errorTools]);

  useEffect(() => {
    if (isErrorAgents) {
      const errorMessage = errorAgents instanceof Error ? errorAgents.message : 'Failed to load agents';
      toast.error(`Error loading agents: ${errorMessage}`);
    }
  }, [isErrorAgents, errorAgents]);

  const allTools = new Map<string, { id: string }>();

  // Get tools from agents
  Object.values(agents).forEach(agent => {
    if (agent.tools) {
      Object.values(agent.tools).forEach(tool => {
        if (!allTools.has(tool.id)) {
          allTools.set(tool.id, tool);
        }
      });
    }
  });

  // Get standalone/discovered tools
  Object.values(tools).forEach(tool => {
    if (!allTools.has(tool.id)) {
      allTools.set(tool.id, tool);
    }
  });

  const toolOptions = Array.from(allTools.values()).map(tool => ({
    label: tool.id,
    value: tool.id,
  }));

  const handleValueChange = (newToolId: string) => {
    if (onValueChange) {
      onValueChange(newToolId);
    } else if (newToolId && newToolId !== value) {
      navigate(paths.toolLink(newToolId));
    }
  };

  return (
    <Combobox
      options={toolOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoadingTools || isLoadingAgents ? 'Loading tools...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoadingTools || isLoadingAgents || isErrorTools || isErrorAgents}
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
    />
  );
}
