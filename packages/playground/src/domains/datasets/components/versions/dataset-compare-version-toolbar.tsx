import { Column } from '@mastra/playground-ui/components/Columns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useDatasetVersions } from '@mastra/react/hooks';

export interface DatasetCompareVersionToolbarProps {
  datasetId: string;
  versionA?: string;
  versionB?: string;
  onVersionChange?: (versionA: string, versionB: string) => void;
}

function formatVersionLabel(version: number, createdAt?: Date | string): string {
  if (createdAt) {
    const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return `v${version}  ${formatDate(d, 'date-time')}`;
  }
  return `v${version}`;
}

export function DatasetCompareVersionToolbar({
  datasetId,
  versionA,
  versionB,
  onVersionChange,
}: DatasetCompareVersionToolbarProps) {
  const { data: versions } = useDatasetVersions(datasetId);

  const options = (versions ?? []).map(v => ({
    value: String(v.version),
    label: `${formatVersionLabel(v.version, v.createdAt)}${v.isCurrent ? ' (current)' : ''}`,
  }));

  return (
    <Column.Toolbar className="grid w-full grid-cols-[1fr_1fr_1fr_10rem] gap-4">
      <div />
      <Select value={versionA ?? ''} onValueChange={(val: string) => onVersionChange?.(val, versionB ?? '')}>
        <SelectTrigger aria-label="Version A" size="md">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={versionB ?? ''} onValueChange={(val: string) => onVersionChange?.(versionA ?? '', val)}>
        <SelectTrigger aria-label="Version B" size="md">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div />
    </Column.Toolbar>
  );
}
