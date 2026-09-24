import { Badge } from '@mastra/playground-ui/components/Badge';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { usePromptBlockVersions } from '../hooks/use-prompt-block-versions';

export interface PromptBlockVersionComboboxProps {
  blockId: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  activeVersionId?: string;
}

export function PromptBlockVersionCombobox({
  blockId,
  value,
  onValueChange,
  className,
  disabled = false,
  variant,
  activeVersionId,
}: PromptBlockVersionComboboxProps) {
  const { data, isLoading } = usePromptBlockVersions({
    blockId,
    params: { orderBy: { direction: 'DESC' } },
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
        description: formatDate(version.createdAt, 'date-time') ?? '',
        end: isPublished ? (
          <Badge variant="green">Published</Badge>
        ) : isDraft ? (
          <Badge variant="blue">Draft</Badge>
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
