import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useDataset } from '@mastra/react/hooks/datasets';
import { DatabaseIcon } from 'lucide-react';

/**
 * The compared dataset, linked. Its version stays on each experiment header, since experiments
 * of one dataset may have run on different versions. Falls back to its id when it cannot be loaded.
 */
export function ComparisonDatasetHeader({ datasetId }: { datasetId: string }) {
  const { Link, paths } = useLinkComponent();
  const { data: dataset } = useDataset({ datasetId });

  const name = dataset?.name || datasetId;

  return (
    <Button
      render={<Link href={paths.datasetLink(datasetId)} />}
      size="sm"
      icon={<DatabaseIcon />}
      className="max-w-full min-w-0 justify-self-start"
      aria-label={`Open dataset ${name}`}
    >
      <span className="min-w-0 truncate">{name}</span>
    </Button>
  );
}
