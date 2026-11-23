import type { DatasetExperiment } from '@mastra/client-js';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

const LONG_DESCRIPTION = 60;

/** Single truncated line with the experiment display name. Caller supplies the cell. */
export function ExperimentNameLabel({ experiment }: { experiment: DatasetExperiment }) {
  return (
    <span className="block min-w-0 truncate text-left text-muted-foreground">
      {getExperimentDisplayName(experiment)}
    </span>
  );
}

/**
 * Single truncated line with the description; long descriptions get a tooltip
 * with the full text. Caller supplies the cell.
 */
export function ExperimentDescriptionLabel({ experiment }: { experiment: DatasetExperiment }) {
  const description = experiment.description;
  if (!description) {
    return <span className="text-subtle-foreground">—</span>;
  }

  const label = <span className="block min-w-0 truncate text-left text-muted-foreground">{description}</span>;

  if (description.length <= LONG_DESCRIPTION) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
