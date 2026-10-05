import { Badge } from '@mastra/playground-ui/components/Badge';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useAllAgentVersions } from '../hooks/use-agent-versions';

export interface AgentVersionComboboxProps {
  agentId: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  activeVersionId?: string;
}

export function AgentVersionCombobox({
  agentId,
  value,
  onValueChange,
  className,
  disabled = false,
  variant,
  activeVersionId,
}: AgentVersionComboboxProps) {
  const { data, isLoading } = useAllAgentVersions(
    {
      agentId,
      params: { orderBy: { direction: 'DESC' } },
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  const versions = data?.versions ?? [];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  const options = [
    { label: 'Latest', value: '' },
    ...versions.map(version => {
      const isProduction = version.id === activeVersionId;
      const isDraft = activeVersionNumber !== undefined && version.versionNumber > activeVersionNumber;

      const trimmedMessage = version.changeMessage?.trim();
      const description = [
        formatDate(version.createdAt, 'date-time') ?? '',
        trimmedMessage && trimmedMessage !== 'Auto-saved after edit' ? trimmedMessage : undefined,
      ]
        .filter(Boolean)
        .join(' — ');

      return {
        label: `v${version.versionNumber}`,
        value: version.id,
        description,
        end: isProduction ? (
          <Badge variant="success">Production</Badge>
        ) : isDraft ? (
          <Badge variant="info">Draft</Badge>
        ) : undefined,
      };
    }),
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
