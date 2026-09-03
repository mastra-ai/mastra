import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ClipboardCheck } from 'lucide-react';
import { ExperimentFlowChain } from '@/domains/experiments/components/experiment-flow-chain';
import { ExperimentMetaBar } from '@/domains/experiments/components/experiment-meta-bar';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';
import { RenameExperimentButton } from '@/domains/experiments/components/rename-experiment-button';
import { RerunExperimentButton } from '@/domains/experiments/components/rerun-experiment-button';
import { experimentReviewQueueLink } from '@/lib/app-routing';
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

  const versionLinkHref =
    experiment.agentVersion && experiment.targetType === 'agent' && experiment.targetId
      ? `${paths.agentLink(experiment.targetId)}/editor?version=${encodeURIComponent(experiment.agentVersion)}`
      : null;

  return (
    <PageLayout.TopArea>
      <PageLayout.Row>
        <PageLayout.Column className="justify-items-start gap-3">
          <div className="flex items-start gap-3">
            {/* h-7 matches the title line-height so the icon centers on the title. */}
            <ExperimentStatusIcon status={experiment.status} className="h-7" />
            <PageHeader>
              {/* The run is the subject of the page; what it ran on is spelled out by the chain below. */}
              <div className="flex items-center gap-1">
                <PageHeader.Title>{experiment.name || `Experiment #${experiment.id.slice(0, 8)}`}</PageHeader.Title>
                <RenameExperimentButton experiment={experiment} />
              </div>
              {experiment.description && <PageHeader.Description>{experiment.description}</PageHeader.Description>}
              <ExperimentFlowChain experiment={experiment} className="mt-2" />
            </PageHeader>
          </div>
        </PageLayout.Column>
        <PageLayout.Column className="justify-items-end gap-3">
          <div className="flex items-center gap-2">
            <Button as={LinkComponent} to={experimentReviewQueueLink(experiment.id)}>
              <ClipboardCheck />
              View items to review
            </Button>
            <RerunExperimentButton experiment={experiment} />
          </div>
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
