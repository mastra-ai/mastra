import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { getShortId, TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { CalendarIcon, HashIcon, LayersIcon, TargetIcon } from 'lucide-react';
import type { ComparisonRole } from './build-comparison-rows';
import { ComparisonScoreRow } from './comparison-score-row';
import { ComparisonSection } from './comparison-section';

export interface ScorerSummary {
  scorerId: string;
  average: number | null;
  /** Difference against the baseline average. Null on the baseline. */
  delta: number | null;
}

export interface ComparisonSideHeaderProps {
  role: ComparisonRole;
  /** Column badge, e.g. `Baseline` or `Contender 2`. */
  label: string;
  experiment?: DatasetExperiment;
  /** Per-scorer averages across every item. Contenders also render their delta against the baseline. */
  summary?: ScorerSummary[];
  /** Highlights the dataset version when this experiment disagrees with the baseline on it. */
  versionMismatch?: boolean;
  /** Makes this contender the baseline. Omitted on the baseline itself. */
  onSetBaseline?: () => void;
}

const sideVariant = { baseline: 'purple', contender: 'blue' } as const;

/** Inline link: small leading glyph, truncating name, small trailing external cue. */
const linkClass = 'flex min-w-0 items-center gap-1.5 hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0';

/** Header cell of one comparison side: which experiment it is, and its averages. */
export function ComparisonSideHeader({
  role,
  label,
  experiment,
  summary,
  versionMismatch,
  onSetBaseline,
}: ComparisonSideHeaderProps) {
  const { Link, paths } = useLinkComponent();

  const shortId = experiment ? (getShortId(experiment.id) ?? experiment.id) : null;
  const createdAt = experiment?.createdAt ? new Date(experiment.createdAt) : null;

  const scorerSummary = summary ?? [];

  return (
    <div className="grid content-start gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant={sideVariant[role]} size="xs">
          {label}
        </Badge>
        {experiment && (
          <Button
            render={<Link href={`/experiments/${experiment.id}`} />}
            size="sm"
            className="max-w-full min-w-0"
            aria-label={`Open experiment ${experiment.name || shortId}`}
          >
            <span className="min-w-0 truncate">{experiment.name || shortId}</span>
          </Button>
        )}
        {onSetBaseline && (
          <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onSetBaseline}>
            Set as baseline
          </Button>
        )}
      </div>

      {experiment && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
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
          <TextAndIcon className={cn(versionMismatch && 'text-warning-foreground')}>
            <LayersIcon /> v{experiment.datasetVersion ?? '—'}
            {versionMismatch && ' · different dataset version'}
          </TextAndIcon>
          {createdAt && (
            <TextAndIcon>
              <CalendarIcon /> {formatDate(createdAt, 'date-time')}
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
                delta={role === 'contender' ? delta : null}
              />
            ))}
          </div>
        </ComparisonSection>
      )}
    </div>
  );
}
