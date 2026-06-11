import type { DatasetExperiment, ToolReplayOnMiss } from '@mastra/client-js';
import { Button, Combobox, Icon, Label, Notice, Switch } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDatasetExperiments } from '../../hooks/use-dataset-experiments';
import { isReplayExperiment } from '@/domains/experiments/utils/tool-replay';

export interface ToolReplaySelectorProps {
  datasetId: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  fromExperimentId: string;
  onFromExperimentIdChange: (experimentId: string) => void;
  onMiss: ToolReplayOnMiss;
  onMissChange: (onMiss: ToolReplayOnMiss) => void;
  /** Sorts source experiments targeting this agent first. */
  selectedTargetId?: string;
  disabled?: boolean;
  container?: React.RefObject<HTMLElement | null>;
}

/**
 * Sentinel source value: replay each item from its own recorded trace
 * (`metadata.replayTraceId` — stamped when an item is saved from a traced
 * run) instead of mapping items through a prior experiment's results.
 */
export const ITEM_RECORDINGS_SOURCE = '__item-recordings__';

/**
 * Replay sources must be completed live agent runs: a replay experiment's
 * traces contain no tool spans, so the backend rejects it as a source — the
 * picker mirrors that rule instead of surfacing a doomed option.
 */
export function getEligibleReplaySources(experiments: DatasetExperiment[]): DatasetExperiment[] {
  return experiments.filter(
    exp => exp.status === 'completed' && exp.targetType === 'agent' && !isReplayExperiment(exp),
  );
}

export function ToolReplaySelector({
  datasetId,
  enabled,
  onEnabledChange,
  fromExperimentId,
  onFromExperimentIdChange,
  onMiss,
  onMissChange,
  selectedTargetId,
  disabled,
  container,
}: ToolReplaySelectorProps) {
  const { data, isLoading } = useDatasetExperiments(datasetId, { page: 0, perPage: 100 });

  // Passthrough is the dangerous state: if it arrives already enabled, the
  // Advanced disclosure starts open — and stays open while active — so the
  // live-execution switch and its warning are never hidden.
  const [advancedOpen, setAdvancedOpen] = useState(onMiss === 'passthrough');
  const showAdvanced = advancedOpen || onMiss === 'passthrough';

  const sourceOptions = useMemo(() => {
    const eligible = getEligibleReplaySources(data?.experiments ?? []);
    const sorted = [...eligible].sort((a, b) => {
      if (selectedTargetId) {
        const aMatches = a.targetId === selectedTargetId;
        const bMatches = b.targetId === selectedTargetId;
        if (aMatches !== bMatches) return aMatches ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return [
      {
        value: ITEM_RECORDINGS_SOURCE,
        label: "Each item's recorded trace",
        description: 'Items saved from a traced run replay their own recording (replayTraceId)',
      },
      ...sorted.map(exp => ({
        value: exp.id,
        label: exp.name ? `${exp.name} (${exp.id.slice(0, 8)})` : `${exp.id.slice(0, 8)} · ${exp.targetId}`,
        description: exp.completedAt
          ? `Completed ${format(new Date(exp.completedAt), 'MMM d, yyyy h:mm a')}`
          : undefined,
      })),
    ];
  }, [data?.experiments, selectedTargetId]);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="tool-replay-toggle">Replay tools from a previous experiment</Label>
        <Switch
          id="tool-replay-toggle"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label="Replay tools from a previous experiment"
        />
      </div>

      {enabled && (
        <div className="grid gap-4 pt-1">
          <div className="grid gap-2">
            <Label>Recording source</Label>
            <Combobox
              options={sourceOptions}
              value={fromExperimentId}
              onValueChange={onFromExperimentIdChange}
              placeholder="Select a recording source"
              searchPlaceholder="Search sources..."
              emptyText="No recording sources"
              disabled={disabled || isLoading}
              container={container}
            />
            <p className="text-ui-sm text-neutral3">
              {fromExperimentId === ITEM_RECORDINGS_SOURCE
                ? 'Each item replays the trace it was saved from. Items without a recorded trace fail explicitly — they never run live unnoticed.'
                : "Tool calls return the outputs recorded in the source experiment's traces — no live tools run."}
            </p>
          </div>

          <p className="text-ui-sm text-neutral3">
            If the agent makes a call that isn&apos;t on the recording, the item stops safely — nothing real ever runs.
          </p>

          <div className="grid gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              aria-expanded={showAdvanced}
              onClick={() => setAdvancedOpen(!showAdvanced)}
              disabled={disabled}
            >
              <Icon size="sm">{showAdvanced ? <ChevronDown /> : <ChevronRight />}</Icon>
              Advanced
            </Button>

            {showAdvanced && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tool-replay-on-miss-passthrough" className="font-normal">
                    Allow live execution for unrecorded calls (passthrough)
                  </Label>
                  <Switch
                    id="tool-replay-on-miss-passthrough"
                    checked={onMiss === 'passthrough'}
                    onCheckedChange={checked => onMissChange(checked ? 'passthrough' : 'error')}
                    disabled={disabled}
                    aria-label="Allow live execution for unrecorded calls (passthrough)"
                  />
                </div>

                {onMiss === 'passthrough' && (
                  <Notice variant="warning" title="Live execution on miss">
                    <Notice.Message>
                      Unmatched calls will execute against real systems, including writes. Every passthrough is recorded
                      in the divergence report.
                    </Notice.Message>
                  </Notice>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
