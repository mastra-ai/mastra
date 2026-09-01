import type { DatasetExperiment } from '@mastra/client-js';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRightIcon, ExternalLinkIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentFlowChainProps {
  experiment: DatasetExperiment;
  className?: string;
}

const TARGET_ICON = {
  agent: AgentIcon,
  workflow: WorkflowIcon,
  scorer: ScorersIcon,
  processor: ProcessorIcon,
} as const;

const TARGET_LABEL = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
} as const;

/** One step's subject: a typed icon (tooltip names the type) plus its label. */
function Node({
  icon,
  typeLabel,
  children,
}: {
  icon: ReactNode;
  /** Named on the icon so the chain reads without a legend. */
  typeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="text-ui-sm text-neutral5 flex flex-none items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      <Tooltip>
        <TooltipTrigger render={<span className="text-neutral3 flex" role="img" aria-label={typeLabel} />}>
          {icon}
        </TooltipTrigger>
        <TooltipContent>{typeLabel}</TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}

/** The labelled arrow between two nodes — the label is what makes the flow readable. */
function Step({ label }: { label: string }) {
  return (
    <div className="text-neutral2 text-ui-xs flex flex-none items-center gap-1.5">
      <span className="whitespace-nowrap">{label}</span>
      <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden />
    </div>
  );
}

const linkClass =
  'text-neutral5 inline-flex items-center gap-1.5 hover:underline [&>svg]:text-neutral3 [&>svg]:size-3 [&>svg]:shrink-0';

/**
 * Reads the experiment as the pipeline it actually is: every dataset item is sent
 * to the target, and its output is compared against the item's ground truth by the
 * scorers. Purely explanatory — it carries no measurement, the meta bar does.
 */
export function ExperimentFlowChain({ experiment, className }: ExperimentFlowChainProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(experiment.datasetId ?? '');
  const { data: scoresByItemId } = useScoresByExperimentId(experiment.id, experiment.status);

  // Scorers are pinned on the experiment at create time, but that field is null
  // when they resolve from the dataset or the items, so fall back to whichever
  // scorers actually produced a score.
  const scorerIds = useMemo(() => {
    if (experiment.scorerIds?.length) return experiment.scorerIds;
    if (!scoresByItemId) return [];
    const ids = new Set<string>();
    for (const scores of Object.values(scoresByItemId)) {
      for (const score of scores) ids.add(score.scorerId);
    }
    return [...ids].sort();
  }, [experiment.scorerIds, scoresByItemId]);

  const scorerNames = scorerIds.map(id => scorers?.[id]?.scorer?.config?.name ?? id);

  const targetType = experiment.targetType;
  const targetId = experiment.targetId;

  const targetName = () => {
    if (!targetId) return 'External (caller-run)';
    switch (targetType) {
      case 'agent':
        return agents?.[targetId]?.name ?? targetId;
      case 'workflow':
        return workflows?.[targetId]?.name ?? targetId;
      case 'scorer':
        return scorers?.[targetId]?.scorer?.config?.name ?? targetId;
      default:
        return targetId;
    }
  };

  const targetHref = () => {
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
  };

  const TargetIcon = (targetType && TARGET_ICON[targetType]) || AgentIcon;
  const targetTypeLabel = (targetType && TARGET_LABEL[targetType]) || 'Evaluation target';
  const href = targetHref();

  return (
    <div className={cn('flex items-center gap-3 overflow-x-auto', className)}>
      <Node icon={<DatasetsIcon />} typeLabel="Dataset">
        {experiment.datasetId ? (
          <LinkComponent
            href={paths.datasetLink(experiment.datasetId)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {isDatasetLoading ? <Skeleton className="h-4 w-28" /> : (dataset?.name ?? experiment.datasetId)}
            {experiment.datasetVersion != null && <span className="text-neutral3">(v{experiment.datasetVersion})</span>}
            <ExternalLinkIcon />
          </LinkComponent>
        ) : (
          <span className="text-neutral3">No dataset</span>
        )}
      </Node>

      <Step label="each item" />

      <Node icon={<TargetIcon />} typeLabel={targetTypeLabel}>
        {href ? (
          <LinkComponent href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {targetName()}
            <ExternalLinkIcon />
          </LinkComponent>
        ) : (
          <span className="text-neutral3">{targetName()}</span>
        )}
      </Node>

      <Step label="output" />

      <Tooltip>
        {/* Focusable so the scorer list is reachable without a pointer. */}
        <TooltipTrigger
          render={
            <div tabIndex={0} className="flex outline-offset-4">
              <Node icon={<ScorersIcon />} typeLabel="Scorers">
                {scorerIds.length === 0 ? 'Scorers' : `${scorerIds.length} scorer${scorerIds.length === 1 ? '' : 's'}`}
              </Node>
            </div>
          }
        />
        <TooltipContent>
          {scorerNames.length > 0 ? scorerNames.join(', ') : 'No scorer has produced a score yet'}
        </TooltipContent>
      </Tooltip>

      <Step label="comparing ground truth" />

      <div className="text-ui-sm text-neutral5 flex-none whitespace-nowrap">Score</div>
    </div>
  );
}
