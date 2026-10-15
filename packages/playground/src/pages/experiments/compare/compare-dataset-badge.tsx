import { Badge } from '@mastra/playground-ui/components/Badge';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useDataset } from '@mastra/react/hooks/datasets';
import { DatabaseIcon } from 'lucide-react';
import { useComparedExperimentIds } from './use-compared-experiment-ids';

/** The compared dataset, as a badge linking to it. Falls back to its id when it cannot be loaded. */
export function CompareDatasetBadge() {
  const { datasetId } = useComparedExperimentIds();
  const { Link, paths } = useLinkComponent();
  const { data: dataset, isLoading } = useDataset({
    datasetId: datasetId ?? '',
    queryOptions: { enabled: Boolean(datasetId) },
  });
  if (!datasetId || isLoading) return null;

  const name = dataset?.name || datasetId;

  return (
    <Link
      href={paths.datasetLink(datasetId)}
      aria-label={`Open dataset ${name}`}
      className={cn('flex max-w-64 min-w-0 rounded-[7px] hover:brightness-110', focusRing)}
    >
      <Badge size="md" icon={<DatabaseIcon />} className="max-w-full min-w-0">
        <span className="min-w-0 truncate">{name}</span>
      </Badge>
    </Link>
  );
}
