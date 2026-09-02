import type { DatasetExperiment } from '@mastra/client-js';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';

const LONG_DESCRIPTION = 60;

/**
 * Primary line: the experiment name, or a readable `Experiment #<short id>` when
 * unnamed. Secondary line: the description, or a version/scorer summary so an
 * unnamed run is still identifiable at a glance. Caller supplies the cell.
 */
export function ExperimentNameLabel({ experiment }: { experiment: DatasetExperiment }) {
  const shortId = getShortId(experiment.id) ?? experiment.id;
  const primary = experiment.name || `Experiment #${shortId}`;
  const secondary = experiment.description || buildRunSummary(experiment);

  const label = (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left">
      <span className="text-neutral4 block truncate">{primary}</span>
      {secondary && <span className="text-ui-sm text-neutral2 block truncate">{secondary}</span>}
    </span>
  );

  if (!experiment.description || experiment.description.length <= LONG_DESCRIPTION) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{experiment.description}</TooltipContent>
    </Tooltip>
  );
}

function buildRunSummary(experiment: DatasetExperiment): string | null {
  const parts: string[] = [];
  if (experiment.datasetVersion != null) parts.push(`v${experiment.datasetVersion}`);
  const scorerCount = experiment.scorerIds?.length ?? 0;
  if (scorerCount > 0) parts.push(`${scorerCount} scorer${scorerCount > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' · ') : null;
}
