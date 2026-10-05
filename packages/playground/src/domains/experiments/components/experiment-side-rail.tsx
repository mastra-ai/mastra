import type { DatasetExperiment } from '@mastra/client-js';
import { Card } from '@mastra/playground-ui/components/Card';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useScoresByExperimentId } from '@mastra/react/hooks';
import type { useExperimentMetrics } from '@mastra/react/hooks';
import { ExperimentFlowChain } from './experiment-flow-chain';
import { ExperimentRunMeta } from './experiment-run-meta';
import { ExperimentScorerSummary } from './experiment-scorer-summary';

export interface ExperimentSideRailProps {
  experiment: DatasetExperiment;
  metrics?: ReturnType<typeof useExperimentMetrics>;
  className?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <Txt as="h2" variant="subheading" tone="ink">
        {title}
      </Txt>
      {children}
    </section>
  );
}

export function ExperimentSideRail({ experiment, metrics, className }: ExperimentSideRailProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: scoresByItemId } = useScoresByExperimentId({
    experimentId: experiment.id,
    experimentStatus: experiment.status,
    queryOptions: { enabled: Boolean(experiment.id) },
  });

  const versionLinkHref =
    experiment.agentVersion && experiment.targetType === 'agent' && experiment.targetId
      ? `${paths.agentLink(experiment.targetId)}/editor?version=${encodeURIComponent(experiment.agentVersion)}`
      : null;

  return (
    <Card as="aside" aria-label="Experiment details" className={cn('grid content-start gap-5 p-5', className)}>
      <Section title="Pipeline">
        <ExperimentFlowChain experiment={experiment} />
        {experiment.agentVersion && (
          <DataKeysAndValues>
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
      </Section>

      <Section title="Run">
        <ExperimentRunMeta experiment={experiment} metrics={metrics} />
      </Section>

      <Section title="Scorers">
        <ExperimentScorerSummary scoresByItemId={scoresByItemId} experimentStatus={experiment.status} />
      </Section>
    </Card>
  );
}
