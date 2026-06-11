import type { DatasetExperiment } from '@mastra/client-js';
import { Chip, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { formatMockedToolNames, getReplayMarker } from '../utils/tool-replay';

/**
 * Marks experiments that ran with tool replay and/or tool mocks.
 * Non-interactive on purpose: it mounts inside list rows that are themselves
 * links/buttons.
 */
export function ToolReplayChip({ experiment }: { experiment: Pick<DatasetExperiment, 'metadata'> }) {
  const marker = getReplayMarker(experiment);
  if (!marker) return null;

  // Replay markers always carry `onMiss`; mock-only markers never do.
  const hasReplay = marker.onMiss !== undefined;
  const hasMocks = marker.mockedTools !== undefined;
  const label = hasReplay && hasMocks ? 'Replay+Mocks' : hasMocks ? 'Mocks' : 'Replay';

  const parts: string[] = [];
  if (hasReplay) {
    const source = marker.fromExperimentId ? `experiment ${marker.fromExperimentId.slice(0, 8)}` : 'recorded traces';
    parts.push(`Tool replay from ${source}`, `on miss: ${marker.onMiss}`);
  }
  if (marker.matching) {
    parts.push(`matching: ${marker.matching}`);
  }
  if (hasMocks) {
    const names = marker.mockedTools ?? [];
    parts.push(names.length > 0 ? `mocked: ${formatMockedToolNames(names)}` : 'mocked tools');
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Chip color="purple" size="small">
            {label}
          </Chip>
        </span>
      </TooltipTrigger>
      <TooltipContent>{parts.join(' · ')}</TooltipContent>
    </Tooltip>
  );
}
