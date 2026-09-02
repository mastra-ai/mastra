import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList as EntityList } from '@mastra/playground-ui/components/DataList';
import { formatExperimentDate, STATUS_LABEL, STATUS_VARIANT } from './experiment-columns';
import { ExperimentNameLabel } from './experiment-name-label';
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
        <ExperimentTargetCell experiment={exp} />
      </EntityList.Cell>
      <EntityList.Cell>
        <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} indicator="dot">
          {STATUS_LABEL[status] ?? status}
        </Badge>
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

function ExperimentTargetCell({ experiment }: { experiment: DatasetExperiment }) {
  const registries = useTargetRegistries();
  const name = resolveTargetName(experiment, registries);
  const targetType = experiment.targetId ? experiment.targetType : null;
  const TargetIcon = targetType ? TARGET_ICON[targetType] : null;

  return (
    <span className="flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      {TargetIcon && (
        <span className="text-neutral3 flex" role="img" aria-label={TARGET_LABEL[targetType!]}>
          <TargetIcon />
        </span>
      )}
      <span className={targetType ? 'truncate' : 'text-neutral2 truncate'}>{name}</span>
    </span>
  );
}

function ExperimentReviewCell({ review }: { review?: ExperimentReviewSummary }) {
  if (!review) return <span className="text-neutral2">—</span>;
  const inPipeline = review.needsReview + review.complete;
  if (inPipeline === 0) return <span className="text-neutral2">—</span>;
  if (review.needsReview > 0) {
    return (
      <Badge size="xs" variant="yellow">
        {review.needsReview} pending
      </Badge>
    );
  }
  return (
    <Badge size="xs" variant="green">
      {review.complete}/{inPipeline} reviewed
    </Badge>
  );
}
