import type { DatasetExperiment } from '@mastra/client-js';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useExperimentScorerIds } from '@/domains/experiments/hooks/use-experiment-scorer-ids';
import { useTargetRegistries } from '@/domains/experiments/hooks/use-target-registries';
import { resolveTargetName, TARGET_ICON, TARGET_LABEL } from '@/domains/experiments/utils/target-name';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentFlowChainProps {
  experiment: DatasetExperiment;
  className?: string;
}

/**
 * One stage of the pipeline: a typed icon (tooltip names the type), the stage's
 * subject, and a one-line description of what happens to the data next. Stages
 * are joined by a vertical rail; the last one has none.
 */
function Stage({
  icon,
  typeLabel,
  subject,
  description,
  isLast = false,
}: {
  icon: ReactNode;
  /** Named on the icon so the chain reads without a legend. */
  typeLabel: string;
  subject: ReactNode;
  description: string;
  isLast?: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[auto_1fr] gap-x-2.5 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="text-neutral3 flex size-5 shrink-0 items-center justify-center [&_svg]:size-3.5"
                role="img"
                aria-label={typeLabel}
              />
            }
          >
            {icon}
          </TooltipTrigger>
          <TooltipContent>{typeLabel}</TooltipContent>
        </Tooltip>
        {!isLast && <span aria-hidden className="bg-border1 mt-1 w-px flex-1" />}
      </div>
      <div className="grid min-w-0 gap-0.5">
        <div className="text-ui-sm text-neutral5 flex min-h-5 items-center">{subject}</div>
        <p className="text-ui-xs text-neutral2">{description}</p>
      </div>
    </li>
  );
}

const linkClass = 'text-neutral5 inline-flex min-w-0 items-center gap-1.5 hover:underline';

/**
 * Reads the experiment as the pipeline it actually is: every dataset item is sent
 * to the target, and its output is scored against the item's ground truth by the
 * scorers. Purely explanatory — it carries no measurement, the run meta does.
 */
export function ExperimentFlowChain({ experiment, className }: ExperimentFlowChainProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const registries = useTargetRegistries();
  const { scorers } = registries;
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(experiment.datasetId ?? '');
  const scorerIds = useExperimentScorerIds(experiment);

  const targetType = experiment.targetType;
  const targetId = experiment.targetId;
  const targetName = resolveTargetName(experiment, registries);

  const targetHref = (() => {
    if (!targetId) return null;
    switch (targetType) {
      case 'agent':
        return paths.agentLink(targetId);
      case 'workflow':
        return paths.workflowLink(targetId);
      case 'scorer':
        return paths.scorerLink(targetId);
      default:
        return null;
    }
  })();

  const TargetIcon = (targetType && TARGET_ICON[targetType]) || AgentIcon;
  const targetTypeLabel = (targetType && TARGET_LABEL[targetType]) || 'Evaluation target';

  return (
    <ol className={cn('grid', className)}>
      <Stage
        icon={<DatasetsIcon />}
        typeLabel="Dataset"
        description={`Each item will be passed to the ${targetTypeLabel.toLowerCase()}`}
        subject={
          experiment.datasetId ? (
            <LinkComponent href={paths.datasetLink(experiment.datasetId)} className={linkClass}>
              <span className="truncate">
                {isDatasetLoading ? <Skeleton className="h-4 w-28" /> : (dataset?.name ?? experiment.datasetId)}
              </span>
              {experiment.datasetVersion != null && (
                <span className="text-neutral3 shrink-0">(v{experiment.datasetVersion})</span>
              )}
            </LinkComponent>
          ) : (
            <span className="text-neutral3">No dataset</span>
          )
        }
      />

      <Stage
        icon={<TargetIcon />}
        typeLabel={targetTypeLabel}
        description="Its output is then scored"
        subject={
          targetHref ? (
            <LinkComponent href={targetHref} className={linkClass}>
              <span className="truncate">{targetName}</span>
            </LinkComponent>
          ) : (
            <span className="text-neutral3 truncate">{targetName}</span>
          )
        }
      />

      <Stage
        icon={<ScorersIcon />}
        typeLabel="Scorers"
        description="It gives a score by comparing ground truth"
        isLast
        subject={
          scorerIds.length === 0 ? (
            <span className="text-neutral3">No scorer has produced a score yet</span>
          ) : (
            <ul className="grid min-w-0 gap-0.5">
              {scorerIds.map(id => {
                const name = scorers?.[id]?.scorer?.config?.name ?? id;
                return (
                  <li key={id} className="min-w-0">
                    <LinkComponent href={paths.scorerLink(id)} className={linkClass}>
                      <span className="truncate">{name}</span>
                    </LinkComponent>
                  </li>
                );
              })}
            </ul>
          )
        }
      />
    </ol>
  );
}
