import type { DatasetExperiment } from '@mastra/client-js';
import { Chip, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { getReplayMarker } from '../utils/tool-replay';

/**
 * Marks experiments that ran with tool replay. Non-interactive on purpose:
 * it mounts inside list rows that are themselves links/buttons.
 */
export function ToolReplayChip({ experiment }: { experiment: Pick<DatasetExperiment, 'metadata'> }) {
  const marker = getReplayMarker(experiment);
  if (!marker) return null;

  const source = marker.fromExperimentId ? `experiment ${marker.fromExperimentId.slice(0, 8)}` : 'recorded traces';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Chip color="purple" size="small">
            Replay
          </Chip>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Tool replay from {source} · on miss: {marker.onMiss}
      </TooltipContent>
    </Tooltip>
  );
}
