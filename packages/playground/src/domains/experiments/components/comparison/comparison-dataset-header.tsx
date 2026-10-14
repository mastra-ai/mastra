import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useDataset } from '@mastra/react/hooks/datasets';
import { DatabaseIcon, HistoryIcon } from 'lucide-react';

export interface ComparisonDatasetHeaderProps {
  datasetId: string;
  /** Dataset version the baseline ran on. Omitted when the baseline did not pin one. */
  version?: number;
}

/** The compared dataset, linked at the version the baseline ran on. Falls back to its id when it cannot be loaded. */
export function ComparisonDatasetHeader({ datasetId, version }: ComparisonDatasetHeaderProps) {
  const { Link, paths } = useLinkComponent();
  const { data: dataset } = useDataset({ datasetId });

  const name = dataset?.name || datasetId;
  const datasetHref = paths.datasetLink(datasetId);
  const href = version === undefined ? datasetHref : `${datasetHref}?version=${version}`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        render={<Link href={href} />}
        size="sm"
        icon={<DatabaseIcon />}
        className="max-w-full min-w-0"
        aria-label={`Open dataset ${name}`}
      >
        <span className="min-w-0 truncate">{name}</span>
      </Button>
      {version !== undefined && (
        <Badge size="md" icon={<HistoryIcon />} className="shrink-0">
          v{version}
        </Badge>
      )}
    </div>
  );
}
