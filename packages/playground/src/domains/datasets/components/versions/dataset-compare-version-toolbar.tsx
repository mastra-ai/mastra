import { Column, SelectFieldBlock } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { useDatasetVersions } from '../../hooks/use-dataset-versions';

export interface DatasetCompareVersionToolbarProps {
  datasetId: string;
  versionA?: string;
  versionB?: string;
  onVersionChange?: (versionA: string, versionB: string) => void;
}

function formatVersionLabel(version: number, createdAt?: Date | string): string {
  if (createdAt) {
    const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    return `v${version}  ${format(d, "MMM dd 'at' H:mm:ss a")}`;
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
    <Column.Toolbar className="grid grid-cols-[1fr_1fr_1fr_10rem] gap-4 w-full">
      <div />
      <SelectFieldBlock
        label="Version A"
        labelIsHidden={true}
        name="version-a"
        placeholder="Select version"
        options={options}
        value={versionA ?? ''}
        onValueChange={(val: string) => onVersionChange?.(val, versionB ?? '')}
      />
      <SelectFieldBlock
        label="Version B"
        labelIsHidden={true}
        name="version-b"
        options={options}
        value={versionB ?? ''}
        onValueChange={(val: string) => onVersionChange?.(versionA ?? '', val)}
      />
      <div />
    </Column.Toolbar>
  );
}
