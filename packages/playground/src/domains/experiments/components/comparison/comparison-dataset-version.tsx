import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';

export interface ComparisonDatasetVersionProps {
  datasetId: string;
  version: number;
  /** Flags the version when it is not the one the baseline ran on. */
  differsFromBaseline?: boolean;
}

/** Dataset version one experiment ran on, linked to the dataset at that version. */
export function ComparisonDatasetVersion({ datasetId, version, differsFromBaseline }: ComparisonDatasetVersionProps) {
  const { Link, paths } = useLinkComponent();

  return (
    <span className={cn('flex min-w-0 items-center gap-2', differsFromBaseline && 'text-warning-foreground')}>
      {differsFromBaseline && <span className="min-w-0 truncate">differs from baseline</span>}
      <Link
        href={`${paths.datasetLink(datasetId)}?version=${version}`}
        aria-label={`Open dataset v${version}`}
        className="shrink-0 hover:underline"
      >
        v{version}
      </Link>
    </span>
  );
}
