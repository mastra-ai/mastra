import { Column } from '@mastra/playground-ui/components/Columns';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useDatasetVersions } from '@mastra/react/hooks/datasets';

export interface DatasetCompareVersionToolbarProps {
  datasetId: string;
  versionA?: string;
  versionB?: string;
  onVersionChange?: (versionA: string, versionB: string) => void;
}

export function DatasetCompareVersionToolbar({
  datasetId,
  versionA,
  versionB,
  onVersionChange,
}: DatasetCompareVersionToolbarProps) {
  const { data: versions } = useDatasetVersions({
    datasetId: datasetId,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  const options = (versions ?? []).map(version => {
    const versionLabel = `v${version.version}`;
    const dateLabel = formatDate(version.createdAt, 'date-time');
    const currentLabel = version.isCurrent ? '(current)' : undefined;
    return {
      value: String(version.version),
      label: [versionLabel, dateLabel, currentLabel].filter(label => label !== undefined).join(' '),
      content: (
        <Metadata>
          <Metadata.Item>{versionLabel}</Metadata.Item>
          {dateLabel && (
            <Metadata.Item>
              <Txt as="span" variant="caption" tone="muted">
                {dateLabel}
              </Txt>
            </Metadata.Item>
          )}
          {currentLabel && <Metadata.Item>{currentLabel}</Metadata.Item>}
        </Metadata>
      ),
    };
  });

  return (
    <Column.Toolbar className="grid w-full grid-cols-[1fr_1fr_1fr_10rem] gap-4">
      <div />
      <Select
        items={options}
        value={versionA ?? ''}
        onValueChange={(val: string) => onVersionChange?.(val, versionB ?? '')}
      >
        <SelectTrigger aria-label="Version A" size="md">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value} label={option.label}>
              {option.content}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={options}
        value={versionB ?? ''}
        onValueChange={(val: string) => onVersionChange?.(versionA ?? '', val)}
      >
        <SelectTrigger aria-label="Version B" size="md">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value} label={option.label}>
              {option.content}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div />
    </Column.Toolbar>
  );
}
