import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { getShortId, TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format } from 'date-fns';
import { CalendarIcon, HashIcon, LayersIcon, TargetIcon } from 'lucide-react';
import { ComparisonScoreRow } from './comparison-score-row';
import { ComparisonSection } from './comparison-section';
import { useLinkComponent } from '@/lib/framework';

export interface ScorerSummary {
  scorerId: string;
  average: number | null;
  /** Difference against the baseline average. Contender side only. */
  delta: number | null;
}

export interface ComparisonSideHeaderProps {
  side: 'baseline' | 'contender';
  experiment?: DatasetExperiment;
  /** Per-scorer averages across every item. */
  summary?: ScorerSummary[];
  /** Only the contender renders deltas, so a difference is stated once. */
  showDeltas?: boolean;
  /** Highlights the dataset version when the two experiments disagree on it. */
  versionMismatch?: boolean;
}

const sideLabel = { baseline: 'Baseline', contender: 'Contender' } as const;
const sideVariant = { baseline: 'purple', contender: 'blue' } as const;

/** Inline link: small leading glyph, truncating name, small trailing external cue. */
const linkClass = 'flex min-w-0 items-center gap-1.5 hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0';

/** Header cell of one comparison side: which experiment it is, and its averages. */
export function ComparisonSideHeader({
  side,
  experiment,
  summary,
  showDeltas,
  versionMismatch,
}: ComparisonSideHeaderProps) {
  const { Link, paths } = useLinkComponent();
  const label = sideLabel[side];

  const shortId = experiment ? (getShortId(experiment.id) ?? experiment.id) : null;
  const createdAt = experiment?.createdAt ? new Date(experiment.createdAt) : null;

  const scorerSummary = summary ?? [];

  return (
    <div className="grid content-start gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant={sideVariant[side]} size="xs">
          {label}
        </Badge>
        {experiment && (
          <Button
            as={Link}
            size="xs"
            href={`/experiments/${experiment.id}`}
            aria-label={`Open experiment ${experiment.name || shortId}`}
          >
            <span className="min-w-0 truncate">{experiment.name || shortId}</span>
          </Button>
        )}
      </div>

      {experiment && (
        <div className="text-ui-sm text-neutral3 flex flex-wrap gap-x-4 gap-y-1">
          {experiment.name && (
            <TextAndIcon>
              <HashIcon /> {shortId}
            </TextAndIcon>
          )}
          {experiment.targetType === 'agent' && experiment.targetId ? (
            <Link href={paths.agentLink(experiment.targetId)} className={linkClass}>
              <AgentIcon />
              <span className="min-w-0 truncate">{experiment.targetId}</span>
            </Link>
          ) : (
            <TextAndIcon>
              <TargetIcon /> {experiment.targetId}
            </TextAndIcon>
          )}
          <span className={cn(versionMismatch && 'text-accent6')}>
            <TextAndIcon>
              <LayersIcon /> v{experiment.datasetVersion ?? '—'}
              {versionMismatch && ' · different dataset version'}
            </TextAndIcon>
          </span>
          {createdAt && (
            <TextAndIcon>
              <CalendarIcon /> {format(createdAt, 'MMM d, yyyy HH:mm')}
            </TextAndIcon>
          )}
        </div>
      )}

      {scorerSummary.length > 0 && (
        <ComparisonSection title="Overall score">
          <div className="grid gap-2">
            {scorerSummary.map(({ scorerId, average, delta }) => (
              <ComparisonScoreRow
                key={scorerId}
                scorerId={scorerId}
                value={average}
                delta={showDeltas ? delta : null}
              />
            ))}
          </div>
        </ComparisonSection>
      )}
    </div>
  );
}
