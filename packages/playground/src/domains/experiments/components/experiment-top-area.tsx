import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLinkIcon } from 'lucide-react';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { ExperimentMetaBar } from '@/domains/experiments/components/experiment-meta-bar';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentTopAreaProps {
  experiment: DatasetExperiment;
}

/**
 * Top area for any Experiment page — keys-and-values (Created/Completed/Target/Version)
 * on the left, stats on the right. Wrapped in PageLayout primitives so it slots into
 * any consumer's PageLayout shell.
 */
export function ExperimentTopArea({ experiment }: ExperimentTopAreaProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();
  const { data: dataset, isLoading: isDatasetLoading } = useDataset(experiment.datasetId ?? '');

  const targetPath = () => {
    if (!experiment.targetId) return null;
    switch (experiment.targetType) {
      case 'agent':
        return paths.agentLink(experiment.targetId);
      case 'workflow':
        return paths.workflowLink(experiment.targetId);
      case 'scorer':
        return paths.scorerLink(experiment.targetId);
      default:
        return '#';
    }
  };

  const targetName = () => {
    const targetId = experiment.targetId;
    if (!targetId) return 'External (caller-run)';
    switch (experiment.targetType) {
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

  const versionLinkHref =
    experiment.agentVersion && experiment.targetType === 'agent' && experiment.targetId
      ? `${paths.agentLink(experiment.targetId)}/editor?version=${encodeURIComponent(experiment.agentVersion)}`
      : null;

  return (
    <PageLayout.TopArea>
      <PageLayout.Row>
        <PageLayout.Column className="justify-items-start gap-3">
          <div className="flex items-start gap-3">
            {/* mt-4 skips the eyebrow line (1rem), h-7 matches the title line-height so the icon centers on the title. */}
            <ExperimentStatusIcon status={experiment.status} className="mt-4 h-7" />
            <PageHeader>
              {/* The title is the dataset, so the eyebrow has to say what this page actually is: one run. */}
              <p className="text-ui-xs text-neutral3 tracking-wider uppercase">
                Experiment #{experiment.id.slice(0, 8)}
              </p>
              <PageHeader.Title>
                {experiment.datasetId ? (
                  <LinkComponent
                    href={paths.datasetLink(experiment.datasetId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-2 transition-colors',
                      'hover:text-neutral4 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-neutral3',
                    )}
                  >
                    {isDatasetLoading ? <Skeleton className="h-6 w-48" /> : (dataset?.name ?? experiment.datasetId)}
                    <ExternalLinkIcon />
                  </LinkComponent>
                ) : (
                  'No dataset'
                )}
                {experiment.datasetVersion != null && (
                  <Badge size="sm" variant="default">
                    v{experiment.datasetVersion}
                  </Badge>
                )}
              </PageHeader.Title>
              <PageHeader.Description>
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <span>Evaluating</span>
                  {(() => {
                    const href = targetPath();
                    return href ? (
                      <LinkComponent
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral4 [&>svg]:text-neutral3 inline-flex items-center gap-1 hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
                      >
                        {targetName()}
                        <ExternalLinkIcon />
                      </LinkComponent>
                    ) : (
                      <span className="text-neutral4">{targetName()}</span>
                    );
                  })()}
                  {experiment.description && <span>· {experiment.description}</span>}
                </span>
              </PageHeader.Description>
            </PageHeader>
          </div>
        </PageLayout.Column>
        <PageLayout.Column className="justify-items-end gap-3">
          {experiment.agentVersion && (
            <DataKeysAndValues numOfCol={1}>
              <DataKeysAndValues.Key>Version</DataKeysAndValues.Key>
              {versionLinkHref ? (
                <DataKeysAndValues.ValueLink href={versionLinkHref} as={LinkComponent}>
                  {experiment.agentVersion}
                </DataKeysAndValues.ValueLink>
              ) : (
                <DataKeysAndValues.Value>{experiment.agentVersion}</DataKeysAndValues.Value>
              )}
            </DataKeysAndValues>
          )}
        </PageLayout.Column>
      </PageLayout.Row>

      {/* Full-bleed: cancel the PageLayout root's horizontal p-6 so the bar's borders span edge to edge. */}
      <ExperimentMetaBar experiment={experiment} className="-mx-6 w-auto" />
    </PageLayout.TopArea>
  );
}
