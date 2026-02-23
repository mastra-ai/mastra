import { format } from 'date-fns';
import { Column } from '@/ds/components/Columns';
import { SelectField } from '@/ds/components/FormFields';
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
    return `v${version} — ${format(d, "MMM dd, yyyy 'at' H:mm:ss a")}`;
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
      <SelectField
        label="Version A"
        labelIsHidden={true}
        placeholder="Select version"
        options={options}
        value={versionA ?? ''}
        onValueChange={val => onVersionChange?.(val, versionB ?? '')}
        variant="experimental"
        size="default"
      />
      <SelectField
        label="Version B"
        labelIsHidden={true}
        options={options}
        value={versionB ?? ''}
        onValueChange={val => onVersionChange?.(versionA ?? '', val)}
        variant="experimental"
        size="default"
      />
      <div />
    </Column.Toolbar>
  );
}
