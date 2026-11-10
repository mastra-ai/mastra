import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { formatCompactNumber } from '@mastra/playground-ui/utils/cost';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import type { ExperimentListMetrics } from '@mastra/react/hooks/experiments';
import { formatCostValue, totalTokens } from './comparison/comparison-metric-format';
import type { sideVariant } from './comparison/constants';
import { STATUS_LABEL, STATUS_VARIANT } from './experiment-columns';
import { ExperimentDescriptionLabel, ExperimentNameLabel } from './experiment-name-label';
import { useTargetRegistries } from '@/domains/experiments/hooks/use-target-registries';
import { resolveTargetName, TARGET_ICON, TARGET_LABEL } from '@/domains/experiments/utils/target-name';

export interface ExperimentReviewSummary {
  needsReview: number;
  complete: number;
  total: number;
}

export interface ExperimentRowCellsProps {
  experiment: DatasetExperiment;
  datasetName?: string;
  review?: ExperimentReviewSummary;
  /** Comparison role badge shown before the name (e.g. "Baseline", "Contender 1"). */
  selectionRole?: ExperimentSelectionRole;
  /** Renders the avg duration, tokens and cost cells; leave off when the store cannot serve metrics. */
  showUsage?: boolean;
  metrics?: ExperimentListMetrics;
}

export interface ExperimentSelectionRole {
  label: string;
  variant: (typeof sideVariant)[keyof typeof sideVariant];
}

export function ExperimentRowCells({
  experiment: exp,
  datasetName,
  review,
  selectionRole,
  showUsage = false,
  metrics,
}: ExperimentRowCellsProps) {
  const status = exp.status ?? 'pending';
  const succeeded = exp.succeededCount ?? 0;
  const failed = exp.failedCount ?? 0;
  const total = exp.totalItems ?? 0;

  return (
    <>
      <DataList.Cell>
        {selectionRole ? (
          <span className="flex min-w-0 items-center gap-2">
            <Badge variant={selectionRole.variant} className="shrink-0">
              {selectionRole.label}
            </Badge>
            <ExperimentNameLabel experiment={exp} />
          </span>
        ) : (
          <ExperimentNameLabel experiment={exp} />
        )}
      </DataList.Cell>
      <DataList.Cell>
        <ExperimentDescriptionLabel experiment={exp} />
      </DataList.Cell>
      {datasetName !== undefined && <DataList.TextCell>{datasetName}</DataList.TextCell>}
      <DataList.Cell>
        <ExperimentTargetCell experiment={exp} />
      </DataList.Cell>
      <DataList.Cell>
        <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} indicator="dot">
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </DataList.Cell>
      <DataList.TextCell className="text-center">{total}</DataList.TextCell>
      <DataList.TextCell className="text-center">{succeeded}</DataList.TextCell>
      <DataList.TextCell className="text-center">
        <span className={failed > 0 ? 'text-destructive-foreground' : ''}>{failed}</span>
      </DataList.TextCell>
      <MetricCell value={runDurationMs(exp)} format={formatDuration} />
      {showUsage && <ExperimentUsageCells metrics={metrics} />}
      <DataList.Cell className="text-center">
        <ExperimentReviewCell review={review} />
      </DataList.Cell>
      <DataList.TextCell>{formatDate(exp.createdAt, 'date') ?? '—'}</DataList.TextCell>
    </>
  );
}

function runDurationMs(experiment: DatasetExperiment): number | undefined {
  if (!experiment.startedAt || !experiment.completedAt) return undefined;
  return new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
}

function ExperimentUsageCells({ metrics }: { metrics?: ExperimentListMetrics }) {
  const avgDurationMs = metrics?.avgDurationMs === undefined ? undefined : Math.round(metrics.avgDurationMs);
  return (
    <>
      <MetricCell value={avgDurationMs} format={formatDuration} />
      <MetricCell value={totalTokens(metrics)} format={formatCompactNumber} />
      <MetricCell value={metrics?.estimatedCost} format={value => formatCostValue(value, metrics?.costUnit)} />
    </>
  );
}

function MetricCell({ value, format }: { value?: number; format: (value: number) => string | undefined }) {
  const formatted = value === undefined ? undefined : format(value);
  return (
    <DataList.TextCell className="text-center tabular-nums">
      {formatted ?? <span className="text-placeholder">—</span>}
    </DataList.TextCell>
  );
}

function ExperimentTargetCell({ experiment }: { experiment: DatasetExperiment }) {
  const registries = useTargetRegistries();
  const name = resolveTargetName(experiment, registries);
  const targetType = experiment.targetId ? experiment.targetType : null;
  const TargetIcon = targetType ? TARGET_ICON[targetType] : null;

  return (
    <span className="flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      {TargetIcon && (
        <span className="flex text-muted-foreground" role="img" aria-label={TARGET_LABEL[targetType!]}>
          <TargetIcon />
        </span>
      )}
      <span className={targetType ? 'truncate' : 'truncate text-placeholder'}>{name}</span>
    </span>
  );
}

function ExperimentReviewCell({ review }: { review?: ExperimentReviewSummary }) {
  if (!review) return <span className="text-placeholder">—</span>;
  const inPipeline = review.needsReview + review.complete;
  if (inPipeline === 0) return <span className="text-placeholder">—</span>;
  if (review.needsReview > 0) {
    return (
      <Badge size="xs" variant="warning">
        {review.needsReview} pending
      </Badge>
    );
  }
  return (
    <Badge size="xs" variant="success">
      {review.complete}/{inPipeline} reviewed
    </Badge>
  );
}
