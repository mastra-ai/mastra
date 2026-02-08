import { Combobox } from '@/ds/components/Combobox';
import { useAgentVersions } from '../hooks/use-agent-versions';

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface AgentVersionComboboxProps {
  agentId: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
}

export function AgentVersionCombobox({
  agentId,
  value,
  onValueChange,
  className,
  disabled = false,
  variant = 'default',
}: AgentVersionComboboxProps) {
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { sortDirection: 'DESC' },
  });

  const versions = data?.versions ?? [];

  const options = [
    { label: 'Latest', value: '' },
    ...versions.map(version => ({
      label: `v${version.versionNumber}`,
      value: version.id,
      description: formatTimestamp(version.createdAt),
    })),
  ];

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={isLoading ? 'Loading versions...' : 'Versions'}
      searchPlaceholder="Search versions..."
      emptyText="No versions found."
      className={className}
      disabled={disabled || isLoading}
      variant={variant}
    />
  );
}
