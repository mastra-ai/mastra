import type { DatasetExperiment } from '@mastra/client-js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';

const LONG_DESCRIPTION = 60;

/** Single truncated line with the experiment display name. Caller supplies the cell. */
export function ExperimentNameLabel({ experiment }: { experiment: DatasetExperiment }) {
  return <span className="text-neutral4 block min-w-0 truncate text-left">{getExperimentDisplayName(experiment)}</span>;
}

/**
 * Single truncated line with the description; long descriptions get a tooltip
 * with the full text. Caller supplies the cell.
 */
export function ExperimentDescriptionLabel({ experiment }: { experiment: DatasetExperiment }) {
  const description = experiment.description;
  if (!description) {
    return <span className="text-neutral2">—</span>;
  }

  const label = <span className="text-neutral3 block min-w-0 truncate text-left">{description}</span>;

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
