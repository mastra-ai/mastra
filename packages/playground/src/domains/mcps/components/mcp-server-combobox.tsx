import { Combobox, toast } from '@mastra/playground-ui';
import type { ComboboxProps } from '@mastra/playground-ui';
import { useEffect } from 'react';
import { useMCPServers } from '../hooks/use-mcp-servers';
import { useLinkComponent } from '@/lib/framework';

export interface MCPServerComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
}

export function MCPServerCombobox({
  value,
  onValueChange,
  placeholder = 'Select an MCP server...',
  searchPlaceholder = 'Search MCP servers...',
  emptyText = 'No MCP servers found.',
  className,
  disabled = false,
  variant = 'inputLike',
  container,
}: MCPServerComboboxProps) {
  const { data: mcpServers = [], isLoading, isError, error } = useMCPServers();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load MCP servers';
      toast.error(`Error loading MCP servers: ${errorMessage}`);
    }
  }, [isError, error]);

  const mcpServerOptions = mcpServers.map(server => ({
    label: server.name,
    value: server.id,
  }));

  const handleValueChange = (newServerId: string) => {
    if (onValueChange) {
      onValueChange(newServerId);
    } else if (newServerId && newServerId !== value) {
      navigate(paths.mcpServerLink(newServerId));
    }
  };

  return (
    <Combobox
      options={mcpServerOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading MCP servers...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      variant={variant}
      container={container}
    />
  );
}
