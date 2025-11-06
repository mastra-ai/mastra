'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
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
  buttonClassName?: string;
  contentClassName?: string;
}

export function MCPServerCombobox({
  value,
  onValueChange,
  placeholder = 'Select an MCP server...',
  searchPlaceholder = 'Search MCP servers...',
  emptyText = 'No MCP servers found.',
  className,
  disabled = false,
  buttonClassName = 'h-8',
  contentClassName,
}: MCPServerComboboxProps) {
  const { data: mcpServers = [], isLoading } = useMCPServers();
  const { navigate, paths } = useLinkComponent();

  const mcpServerOptions = useMemo(() => {
    return mcpServers.map(server => ({
      label: server.name,
      value: server.id,
    }));
  }, [mcpServers]);

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
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading}
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
    />
  );
}
