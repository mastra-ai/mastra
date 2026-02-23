import { Combobox } from '@/ds/components/Combobox';
import { Badge } from '@/ds/components/Badge';
import { usePromptBlockVersions } from '../hooks/use-prompt-block-versions';

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface PromptBlockVersionComboboxProps {
  blockId: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
  activeVersionId?: string;
}

export function PromptBlockVersionCombobox({
  blockId,
  value,
  onValueChange,
  className,
  disabled = false,
  variant = 'default',
  activeVersionId,
}: PromptBlockVersionComboboxProps) {
  const { data, isLoading } = usePromptBlockVersions({
    blockId,
    params: { sortDirection: 'DESC' },
  });

  const versions = data?.versions ?? [];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  const options = [
    { label: 'Latest', value: '' },
    ...versions.map(version => {
      const isPublished = version.id === activeVersionId;
      const isDraft = activeVersionNumber !== undefined && version.versionNumber > activeVersionNumber;

      return {
        label: `v${version.versionNumber}`,
        value: version.id,
        description: formatTimestamp(version.createdAt),
        end: isPublished ? (
          <Badge variant="success">Published</Badge>
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
