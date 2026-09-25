import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useEffect } from 'react';
import { useAgents } from '../hooks/use-agents';

export interface AgentComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  'aria-label'?: string;
  align?: ComboboxProps['align'];
}

export function AgentCombobox({
  value,
  onValueChange,
  placeholder = 'Select an agent...',
  searchPlaceholder = 'Search agents...',
  emptyText = 'No agents found.',
  className,
  disabled = false,
  variant,
  size,
  'aria-label': ariaLabel,
  align,
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
      size={size}
      aria-label={ariaLabel}
      align={align}
    />
  );
}
