import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Combobox } from '@/ds/components/Combobox';
import { useAgents } from '../hooks/use-agents';
import { useLinkComponent } from '@/lib/framework';
import { AgentSourceIcon } from './agent-source-icon';

export interface AgentComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  showSourceIcon?: boolean;
}

export function AgentCombobox({
  value,
  onValueChange,
  placeholder = 'Select an agent...',
  searchPlaceholder = 'Search agents...',
  emptyText = 'No agents found.',
  className,
  disabled = false,
  variant = 'default',
  showSourceIcon = false,
}: AgentComboboxProps) {
  const { data: agents = {}, isLoading, isError, error } = useAgents();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agents';
      toast.error(`Error loading agents: ${errorMessage}`);
    }
  }, [isError, error]);

  const agentOptions = Object.keys(agents).map(key => ({
    label: agents[key]?.name || key,
    value: key,
    start: showSourceIcon ? (
      <AgentSourceIcon source={agents[key]?.source} tooltipClassName="z-[150]" />
    ) : undefined,
  }));

  const handleValueChange = (newAgentId: string) => {
    if (onValueChange) {
      onValueChange(newAgentId);
    } else if (newAgentId && newAgentId !== value) {
      navigate(paths.agentLink(newAgentId));
    }
  };

  return (
    <Combobox
      options={agentOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading agents...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      variant={variant}
    />
  );
}
