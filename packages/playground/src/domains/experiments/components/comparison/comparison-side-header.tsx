import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import {
  CalendarIcon,
  CircleAlertIcon,
  ClockIcon,
  CoinsIcon,
  GaugeIcon,
  HashIcon,
  LayersIcon,
  TargetIcon,
  StarIcon,
} from 'lucide-react';
import type { ComparisonRole } from './build-comparison-rows';
import {
  costDeltaFormatter,
  diff,
  formatCostValue,
  formatDurationDelta,
  formatScore,
  formatTokenCount,
} from './comparison-metric-format';
import { ComparisonMetricList, ScorerLabel } from './comparison-metric-list';
import type { ComparisonMetric } from './comparison-metric-list';
import { ComparisonSection, sectionStackClass } from './comparison-section';

export interface ScorerSummary {
  scorerId: string;
  average: number | null;
  /** Difference against the baseline average. Null on the baseline. */
  delta: number | null;
}

/** Run-level figures of one column, computed from the compared items. */
export interface ComparisonSideMetrics {
  /** Items this experiment ran, out of every compared item. */
  errorCount: number;
  /** Mean of every score across every scorer. */
  averageScore: number | null;
  /** Mean item run duration, in milliseconds. */
  averageDurationMs: number | null;
  /** Total estimated cost of the experiment. Undefined when the observability storage cannot serve metrics. */
  cost?: { value?: number; unit?: string };
  /** Total input plus output tokens of the experiment. Undefined when the observability storage cannot serve metrics. */
  tokens?: { value?: number };
}

export interface ComparisonSideHeaderProps {
  role: ComparisonRole;
  /** Column badge, e.g. `Baseline` or `Contender 2`. */
  label: string;
  experiment?: DatasetExperiment;
  /** Per-scorer averages across every item. Contenders also render their delta against the baseline. */
  summary?: ScorerSummary[];
  metrics?: ComparisonSideMetrics;
  /** Baseline figures, so a contender can show its trend against them. */
  baselineMetrics?: ComparisonSideMetrics;
  /** Highlights the dataset version when this experiment disagrees with the baseline on it. */
  versionMismatch?: boolean;
  /** Makes this contender the baseline. Omitted on the baseline itself. */
  onSetBaseline?: () => void;
}

const sideVariant = { baseline: 'purple', contender: 'blue' } as const;

/** Header cell of one comparison side: which experiment it is, and its run-level figures. */
export function ComparisonSideHeader({
  role,
  label,
  experiment,
  summary,
  metrics,
  baselineMetrics,
  versionMismatch,
  onSetBaseline,
}: ComparisonSideHeaderProps) {
  const { Link, paths } = useLinkComponent();

  const shortId = experiment ? (getShortId(experiment.id) ?? experiment.id) : null;
  const createdAt = experiment?.createdAt ? new Date(experiment.createdAt) : null;

  const isContender = role === 'contender';
  const trend = (value: number | null | undefined, baseline: number | null | undefined) =>
    isContender ? diff(value, baseline) : null;

  const details: ComparisonMetric[] = experiment
    ? [
        ...(experiment.targetId
          ? [
              {
                id: 'target',
                icon: experiment.targetType === 'agent' ? <AgentIcon /> : <TargetIcon />,
                label: experiment.targetType === 'agent' ? 'Agent' : 'Target',
                value:
                  experiment.targetType === 'agent' ? (
                    <Link href={paths.agentLink(experiment.targetId)} className="min-w-0 truncate hover:underline">
                      {experiment.targetId}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate">{experiment.targetId}</span>
                  ),
                delta: null,
              },
            ]
          : []),
        ...(versionMismatch
          ? [
              {
                id: 'dataset-version',
                icon: <LayersIcon />,
                label: 'Dataset',
                value: <span className="text-warning-foreground">different dataset version</span>,
                delta: null,
              },
            ]
          : []),
        ...(createdAt
          ? [
              {
                id: 'created-at',
                icon: <CalendarIcon />,
                label: 'Created',
                value: formatDate(createdAt, 'date'),
                delta: null,
              },
            ]
          : []),
      ]
    : [];

  const cost = metrics?.cost;
  const baselineCost = baselineMetrics?.cost;
  const costTrend =
    cost && baselineCost && cost.unit === baselineCost.unit ? trend(cost.value, baselineCost.value) : null;

  const summaryMetrics: ComparisonMetric[] = [
    ...(cost
      ? [
          {
            id: 'total-cost',
            icon: <CoinsIcon />,
            label: 'Total cost',
            value: formatCostValue(cost.value, cost.unit),
            delta: costTrend,
            formatDelta: costDeltaFormatter(cost.unit),
            higherIsBetter: false,
            emphasis: true,
          },
        ]
      : []),
    ...(metrics
      ? [
          {
            id: 'avg-duration',
            icon: <ClockIcon />,
            label: 'Avg duration',
            value: formatDuration(metrics.averageDurationMs) ?? '-',
            delta: trend(metrics.averageDurationMs, baselineMetrics?.averageDurationMs),
            formatDelta: formatDurationDelta,
            higherIsBetter: false,
            emphasis: true,
          },
        ]
      : []),
    ...(metrics?.tokens
      ? [
          {
            id: 'total-tokens',
            icon: <HashIcon />,
            label: 'Total tokens',
            value: formatTokenCount(metrics.tokens.value),
            delta: trend(metrics.tokens.value, baselineMetrics?.tokens?.value),
            formatDelta: formatTokenCount,
            higherIsBetter: false,
          },
        ]
      : []),
    ...details,
    ...(metrics
      ? [
          {
            id: 'errors',
            icon: <CircleAlertIcon />,
            label: 'Errors',
            value: String(metrics.errorCount),
            delta: trend(metrics.errorCount, baselineMetrics?.errorCount),
            formatDelta: String,
            higherIsBetter: false,
          },
          {
            id: 'avg-score',
            icon: <GaugeIcon />,
            label: 'Avg score',
            value: formatScore(metrics.averageScore),
            delta: trend(metrics.averageScore, baselineMetrics?.averageScore),
          },
        ]
      : []),
    ...(summary ?? []).map(({ scorerId, average, delta }) => ({
      id: `scorer:${scorerId}`,
      icon: <ScorersIcon />,
      label: <ScorerLabel scorerId={scorerId} />,
      value: formatScore(average),
      delta: isContender ? delta : null,
    })),
  ];

  return (
    <div className={sectionStackClass}>
      <div className="flex min-w-0 items-center gap-2">
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
        <div className="ml-auto shrink-0">
          {onSetBaseline ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="Set as baseline"
                    onClick={onSetBaseline}
                    className={cn('cursor-pointer rounded-[7px] hover:brightness-110', focusRing)}
                  />
                }
              >
                <Badge variant={sideVariant[role]} size="md" icon={<StarIcon />}>
                  {label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Set as baseline</TooltipContent>
            </Tooltip>
          ) : (
            <Badge
              variant={sideVariant[role]}
              size="md"
              icon={role === 'baseline' ? <StarIcon className="fill-current" /> : <StarIcon />}
            >
              {label}
            </Badge>
          )}
        </div>
      </div>

      {summaryMetrics.length > 0 && (
        <ComparisonSection title="Summary" collapsible={false}>
          <ComparisonMetricList metrics={summaryMetrics} />
        </ComparisonSection>
      )}
    </div>
  );
}
