import type { DatasetExperiment } from '@mastra/client-js';
import { Chip } from '@mastra/playground-ui/components/Chip';
import { DataList as EntityList } from '@mastra/playground-ui/components/DataList';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { formatExperimentDate, STATUS_LABEL, STATUS_VARIANT } from './experiment-columns';
import { ExperimentNameLabel } from './experiment-name-label';

export interface ExperimentReviewSummary {
  needsReview: number;
  complete: number;
  total: number;
}

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

  return (
    <>
      <EntityList.Cell>
        <ExperimentNameLabel experiment={exp} />
      </EntityList.Cell>
      {datasetName !== undefined && <EntityList.TextCell>{datasetName}</EntityList.TextCell>}
      <EntityList.Cell>
        <span className="truncate">
          {exp.targetType && exp.targetId ? `${exp.targetType} ${exp.targetId}` : 'external'}
        </span>
      </EntityList.Cell>
      <EntityList.Cell>
        <StatusBadge variant={STATUS_VARIANT[status] ?? 'neutral'} withDot>
          {STATUS_LABEL[status] ?? status}
        </StatusBadge>
      </EntityList.Cell>
      <EntityList.TextCell className="text-center">{total}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">{succeeded}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">
        <span className={failed > 0 ? 'text-accent2' : ''}>{failed}</span>
      </EntityList.TextCell>
      <EntityList.Cell className="text-center">
        <ExperimentReviewCell review={review} />
      </EntityList.Cell>
      <EntityList.TextCell>{formatExperimentDate(exp.createdAt)}</EntityList.TextCell>
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
