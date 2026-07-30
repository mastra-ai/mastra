import type { DatasetExperiment } from '@mastra/client-js';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';

/** Experiment name over its short id, falling back to the short id alone when unnamed. Caller supplies the surrounding cell. */
export function ExperimentNameLabel({ experiment }: { experiment: DatasetExperiment }) {
  const shortId = getShortId(experiment.id) ?? experiment.id;

  const label = experiment.name ? (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left">
      <span className="text-neutral4 block truncate">{experiment.name}</span>
      <span className="text-ui-sm text-neutral2 block truncate font-mono">{shortId}</span>
    </span>
  ) : (
    <span className="text-neutral4 block truncate font-mono">{shortId}</span>
  );

  if (!experiment.description) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{experiment.description}</TooltipContent>
    </Tooltip>
  );
}
