import type { DatasetExperiment } from '@mastra/client-js';
import { Card } from '@mastra/playground-ui/components/Card';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExperimentFlowChain } from './experiment-flow-chain';
import { ExperimentRunMeta } from './experiment-run-meta';
import { ExperimentScorerSummary } from './experiment-scorer-summary';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import type { useExperimentMetrics } from '@/domains/experiments/hooks/use-experiment-metrics';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentSideRailProps {
  experiment: DatasetExperiment;
  /** Experiment-scoped metrics resolved by the page; omitted where metrics are not surfaced. */
  metrics?: ReturnType<typeof useExperimentMetrics>;
  className?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-ui-sm text-neutral2 tracking-widest uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Rail beside the results table: the pipeline read top-to-bottom, the run's
 * measurements as a key/value list, and one card per scorer.
 */
export function ExperimentSideRail({ experiment, metrics, className }: ExperimentSideRailProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const { data: scoresByItemId } = useScoresByExperimentId(experiment.id, experiment.status);

  const versionLinkHref =
    experiment.agentVersion && experiment.targetType === 'agent' && experiment.targetId
      ? `${paths.agentLink(experiment.targetId)}/editor?version=${encodeURIComponent(experiment.agentVersion)}`
      : null;

  return (
    <Card as="aside" aria-label="Experiment details" className={cn('grid content-start gap-8 p-5', className)}>
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
