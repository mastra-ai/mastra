import type { DatasetExperiment, ToolReplayOnMiss } from '@mastra/client-js';
import { Combobox, Label, Notice, RadioGroup, RadioGroupItem, Switch } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { useMemo } from 'react';
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
    return sorted.map(exp => ({
      value: exp.id,
      label: exp.name ? `${exp.name} (${exp.id.slice(0, 8)})` : `${exp.id.slice(0, 8)} · ${exp.targetId}`,
      description: exp.completedAt ? `Completed ${format(new Date(exp.completedAt), 'MMM d, yyyy h:mm a')}` : undefined,
    }));
  }, [data?.experiments, selectedTargetId]);

  const hasSources = sourceOptions.length > 0;

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
          {hasSources || isLoading ? (
            <div className="grid gap-2">
              <Label>Source experiment</Label>
              <Combobox
                options={sourceOptions}
                value={fromExperimentId}
                onValueChange={onFromExperimentIdChange}
                placeholder="Select a completed live experiment"
                searchPlaceholder="Search experiments..."
                emptyText="No completed live agent experiments"
                disabled={disabled || isLoading}
                container={container}
              />
              <p className="text-ui-sm text-neutral3">
                Tool calls return the outputs recorded in the source experiment&apos;s traces — no live tools run.
              </p>
            </div>
          ) : (
            <p className="text-ui-sm text-neutral3">
              No completed live agent experiments to replay from. Run a live experiment first — its traces become the
              recording.
            </p>
          )}

          <div className="grid gap-2">
            <Label>When a call has no recorded event</Label>
            <RadioGroup
              value={onMiss}
              onValueChange={value => onMissChange(value === 'passthrough' ? 'passthrough' : 'error')}
              disabled={disabled}
              className="grid gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="error" id="tool-replay-on-miss-error" />
                <Label htmlFor="tool-replay-on-miss-error" className="font-normal">
                  Fail the item (safe default)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="passthrough" id="tool-replay-on-miss-passthrough" />
                <Label htmlFor="tool-replay-on-miss-passthrough" className="font-normal">
                  Run the live tool (passthrough)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {onMiss === 'passthrough' && (
            <Notice variant="warning" title="Live execution on miss">
              <Notice.Message>
                Unmatched calls will execute against real systems, including writes. Every passthrough is recorded in
                the divergence report.
              </Notice.Message>
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}
