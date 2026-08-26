import type { DatasetExperiment } from '@mastra/client-js';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { DataList as EntityList } from '@mastra/playground-ui/components/DataList';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { formatExperimentDate } from './experiment-columns';
import { ExperimentNameLabel } from './experiment-name-label';

export interface ExperimentReviewSummary {
  needsReview: number;
  complete: number;
  total: number;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  running: 'warning',
  failed: 'error',
  pending: 'neutral',
};

export interface ExperimentRowCellsProps {
  experiment: DatasetExperiment;
  /** Rendered as a Dataset column when provided; omit to hide the column entirely. */
  datasetName?: string;
  review?: ExperimentReviewSummary;
}

export function ExperimentRowCells({ experiment: exp, datasetName, review }: ExperimentRowCellsProps) {
  const status = exp.status ?? 'pending';
  const succeeded = exp.succeededCount ?? 0;
  const failed = exp.failedCount ?? 0;
  const total = exp.totalItems ?? 0;
  const successPct = total > 0 ? Math.round((succeeded / total) * 100) : 0;

  return (
    <>
      <EntityList.Cell height="compact">
        <ExperimentNameLabel experiment={exp} />
      </EntityList.Cell>
      {datasetName !== undefined && <EntityList.TextCell height="compact">{datasetName}</EntityList.TextCell>}
      <EntityList.Cell height="compact">
        <span className="truncate">
          {exp.targetType && exp.targetId ? `${exp.targetType} ${exp.targetId}` : 'external'}
        </span>
      </EntityList.Cell>
      <EntityList.Cell height="compact">
        <StatusBadge variant={STATUS_VARIANT[status] ?? 'neutral'} withDot>
          {status}
        </StatusBadge>
      </EntityList.Cell>
      <EntityList.TextCell height="compact" className="text-center">
        {total}
      </EntityList.TextCell>
      <EntityList.TextCell height="compact" className="text-center">
        <span className={succeeded > 0 ? 'text-accent1' : ''}>
          {succeeded} ({successPct}%)
        </span>
      </EntityList.TextCell>
      <EntityList.TextCell height="compact" className="text-center">
        <span className={failed > 0 ? 'text-accent2' : ''}>{failed}</span>
      </EntityList.TextCell>
      <EntityList.Cell height="compact" className="text-center">
        <ExperimentReviewCell review={review} />
      </EntityList.Cell>
      <EntityList.TextCell height="compact">{formatExperimentDate(exp.createdAt)}</EntityList.TextCell>
    </>
  );
}

function ExperimentReviewCell({ review }: { review?: ExperimentReviewSummary }) {
  if (!review) return <span className="text-neutral2">—</span>;
  const inPipeline = review.needsReview + review.complete;
  if (inPipeline === 0) return <span className="text-neutral2">—</span>;
  if (review.needsReview > 0) {
    return (
      <Chip size="small" color="yellow">
        {review.needsReview} pending
      </Chip>
    );
  }
  return (
    <Chip size="small" color="green">
      {review.complete}/{inPipeline} reviewed
    </Chip>
  );
}
