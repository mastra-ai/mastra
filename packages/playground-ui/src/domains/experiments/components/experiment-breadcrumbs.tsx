'use client';

import type { DatasetExperiment } from '@mastra/client-js';
import { ExperimentStatusIcon } from './experiment-stats';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';
import { ExperimentsIcon } from '@/ds/icons/ExperimentsIcon';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentBreadcrumbsProps {
  /** Where the "Experiments" crumb leads. */
  experimentsHref: string;
  experimentId: string;
  /** Undefined while loading, or when the experiment can't be shown; the crumb then shows its short id. */
  experiment?: DatasetExperiment;
}

function ExperimentItemCount({ experiment }: { experiment: DatasetExperiment }) {
  return (
    <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
      <Metadata>
        <Metadata.Item>
          {experiment.totalItems} {experiment.totalItems === 1 ? 'item' : 'items'}
        </Metadata.Item>
        {experiment.failedCount > 0 && <Metadata.Item>{experiment.failedCount} errored</Metadata.Item>}
      </Metadata>
    </Txt>
  );
}

/** "Experiments / <status> <name> <item count>"; the count appears once the run settles. */
export function ExperimentBreadcrumbs({ experimentsHref, experimentId, experiment }: ExperimentBreadcrumbsProps) {
  const { Link } = useLinkComponent();
  const shortId = experimentId.length > 8 ? `${experimentId.slice(0, 8)}...` : experimentId;
  const settled = experiment && experiment.status !== 'running' && experiment.status !== 'pending';

  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
      <Crumb as={Link} href={experimentsHref} icon={<ExperimentsIcon />}>
        Experiments
      </Crumb>
      <Crumb
        as="span"
        isCurrent
        icon={experiment ? <ExperimentStatusIcon status={experiment.status} /> : undefined}
        action={settled ? <ExperimentItemCount experiment={experiment} /> : undefined}
      >
        {experiment?.name || shortId}
      </Crumb>
    </Breadcrumb>
  );
}
