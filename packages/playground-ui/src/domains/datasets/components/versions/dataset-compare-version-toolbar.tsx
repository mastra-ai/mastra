import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Column } from '@/ds/components/Columns';
import { SelectField } from '@/ds/components/FormFields';
import { useLinkComponent } from '@/lib/framework';
import { useDatasetVersions } from '../../hooks/use-dataset-versions';

export interface DatasetCompareVersionToolbarProps {
  datasetId: string;
  versionA?: string;
  versionB?: string;
  onVersionChange?: (versionA: string, versionB: string) => void;
}

function formatVersionLabel(version: Date | string): string {
  const d = typeof version === 'string' ? new Date(version) : version;
  return format(d, "MMM dd, yyyy 'at' H:mm:ss a");
}

export function DatasetCompareVersionToolbar({
  datasetId,
  versionA,
  versionB,
  onVersionChange,
}: DatasetCompareVersionToolbarProps) {
  const { Link } = useLinkComponent();
  const { data: versions } = useDatasetVersions(datasetId);

  const options = (versions ?? []).map(v => ({
    value: String(v.version),
    label: `${formatVersionLabel(v.version)}${v.isCurrent ? ' (current)' : ''}`,
  }));

  return (
    <Column.Toolbar>
      <Button as={Link} to={`/datasets/${datasetId}`} variant="standard" size="default">
        <ArrowLeft />
        Back to Dataset
      </Button>
      <SelectField
        label="Version A"
        placeholder="Select version"
        options={options}
        value={versionA ?? ''}
        onValueChange={val => onVersionChange?.(val, versionB ?? '')}
      />
      <SelectField
        label="Version B"
        placeholder="Select version"
        options={options}
        value={versionB ?? ''}
        onValueChange={val => onVersionChange?.(versionA ?? '', val)}
      />
    </Column.Toolbar>
  );
}
