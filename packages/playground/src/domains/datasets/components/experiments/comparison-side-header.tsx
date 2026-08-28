import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import { getShortId, TextAndIcon } from '@mastra/playground-ui/components/Text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format } from 'date-fns';
import { CalendarIcon, HashIcon, LayersIcon, TargetIcon } from 'lucide-react';
import { ScoreDelta } from './score-delta';
import { useLinkComponent } from '@/lib/framework';

export interface ScorerSummary {
  scorerId: string;
  average: number | null;
  /** Difference against the baseline average. Contender side only. */
  delta: number | null;
}

export interface ComparisonSideHeaderProps {
  side: 'baseline' | 'contender';
  experiment?: DatasetExperiment;
  /** Per-scorer averages across every item. */
  summary?: ScorerSummary[];
  /** Only the contender renders deltas, so a difference is stated once. */
  showDeltas?: boolean;
  /** Highlights the dataset version when the two experiments disagree on it. */
  versionMismatch?: boolean;
}

const sideLabel = { baseline: 'Baseline', contender: 'Contender' } as const;
const sideColor = { baseline: 'purple', contender: 'cyan' } as const;

/** Header cell of one comparison side: which experiment it is, and its averages. */
export function ComparisonSideHeader({
  side,
  experiment,
  summary,
  showDeltas,
  versionMismatch,
}: ComparisonSideHeaderProps) {
  const { Link } = useLinkComponent();
  const label = sideLabel[side];

  const shortId = experiment ? (getShortId(experiment.id) ?? experiment.id) : null;
  const createdAt = experiment?.createdAt ? new Date(experiment.createdAt) : null;

  const summaryData = (summary ?? []).map(({ scorerId, average, delta }) => ({
    key: scorerId,
    label: scorerId,
    value: (
      <span className="flex items-center gap-3">
        <span className="text-neutral5 font-mono">{average != null ? average.toFixed(3) : '-'}</span>
        {showDeltas && delta != null && <ScoreDelta delta={delta} />}
      </span>
    ),
  }));

  return (
    <div className="grid content-start gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Chip color={sideColor[side]} size="small">
          {label}
        </Chip>
        {experiment && (
          <Button as={Link} href={`/experiments/${experiment.id}`}>
            <span className="min-w-0 truncate">{experiment.name || shortId}</span>
          </Button>
        )}
      </div>

      {experiment && (
        <div className="text-ui-sm text-neutral3 flex flex-wrap gap-x-4 gap-y-1">
          {experiment.name && (
            <TextAndIcon>
              <HashIcon /> {shortId}
            </TextAndIcon>
          )}
          <TextAndIcon>
            <TargetIcon /> {experiment.targetType} / {experiment.targetId}
          </TextAndIcon>
          <span className={cn(versionMismatch && 'text-accent6')}>
            <TextAndIcon>
              <LayersIcon /> v{experiment.datasetVersion ?? '—'}
              {versionMismatch && ' · different dataset version'}
            </TextAndIcon>
          </span>
          {createdAt && (
            <TextAndIcon>
              <CalendarIcon /> {format(createdAt, 'MMM d, yyyy HH:mm')}
            </TextAndIcon>
          )}
        </div>
      )}

      <KeyValueList data={summaryData} />
    </div>
  );
}
