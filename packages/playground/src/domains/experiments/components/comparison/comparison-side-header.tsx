import type { DatasetExperiment } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
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
  ChevronDownIcon,
  CircleAlertIcon,
  ClockIcon,
  CoinsIcon,
  Link2Icon,
  GaugeIcon,
  HashIcon,
  HistoryIcon,
  PencilIcon,
  TargetIcon,
  StarIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { LabelCounts } from '../../utils/score-labels';
import { RenameExperimentDialog } from '../rename-experiment-dialog';
import { ScoreLabelCounts } from '../score-label-counts';
import type { ComparisonRole } from './build-comparison-rows';
import { ComparisonDatasetVersion } from './comparison-dataset-version';
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
import { ComparisonSection } from './comparison-section';
import { sideVariant } from './constants';
import { useCompareMetricPreferences } from './use-compare-metric-preferences';

export interface ScorerSummary {
  scorerId: string;
  average: number | null;
  /** Difference against the baseline average. Null on the baseline. */
  delta: number | null;
  /** How many items got each categorical label. Omitted for numeric-only scorers. */
  labelCounts?: LabelCounts;
}

/** Run-level figures of one column, computed from the compared items. */
export interface ComparisonSideMetrics {
  /** Items this experiment ran, out of every compared item. */
  errorCount: number;
  /** Mean of every score across every scorer. */
  averageScore: number | null;
  /** Mean item run duration, in milliseconds. */
  averageDurationMs: number | null;
  /** Total estimated cost of the experiment. */
  cost?: number;
  costUnit?: string;
  /** Total input plus output tokens of the experiment. */
  tokens?: number;
}

export interface ComparisonSideTitleProps {
  role: ComparisonRole;
  /** Column badge, e.g. `Baseline` or `Contender 2`. */
  label: string;
  experiment?: DatasetExperiment;
  /** Makes this contender the baseline. Omitted on the baseline itself. */
  onSetBaseline?: () => void;
}

/** Title of one comparison side: a menu to view or rename the experiment, and its Baseline/Contender badge. */
export function ComparisonSideTitle({ role, label, experiment, onSetBaseline }: ComparisonSideTitleProps) {
  const { Link } = useLinkComponent();
  const [renameOpen, setRenameOpen] = useState(false);
  const shortId = experiment ? (getShortId(experiment.id) ?? experiment.id) : null;
  // The rename route is dataset-scoped, so caller-run experiments without a dataset can't be renamed.
  const canRename = Boolean(experiment?.datasetId);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {experiment && (
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button size="sm" className="max-w-full min-w-0">
                <span className="min-w-0 truncate">{experiment.name || shortId}</span>
                <ChevronDownIcon aria-hidden />
              </Button>
            }
          />
          <DropdownMenu.Content align="start" className="min-w-48">
            <DropdownMenu.Item render={<Link href={`/experiments/${experiment.id}`} />}>
              <Link2Icon /> View experiment
            </DropdownMenu.Item>
            {canRename && (
              <DropdownMenu.Item onSelect={() => setRenameOpen(true)}>
                <PencilIcon /> Rename experiment
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
      {/* Mounted on demand so the form state is seeded from the experiment each time it opens. */}
      {experiment && renameOpen && <RenameExperimentDialog experiment={experiment} open onOpenChange={setRenameOpen} />}
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
  );
}

export interface ComparisonSideSummaryProps {
  role: ComparisonRole;
  experiment?: DatasetExperiment;
  /** Per-scorer averages across every item. Contenders also render their delta against the baseline. */
  summary?: ScorerSummary[];
  metrics?: ComparisonSideMetrics;
  /** Baseline figures, so a contender can show its trend against them. */
  baselineMetrics?: ComparisonSideMetrics;
  /** Highlights the dataset version when this experiment disagrees with the baseline on it. */
  versionMismatch?: boolean;
  /** Shows the total cost and tokens lines. False when the observability storage cannot serve metrics. */
  showUsage?: boolean;
}

/** Run-level figures of one comparison side. */
export function ComparisonSideSummary({
  role,
  experiment,
  summary,
  metrics,
  baselineMetrics,
  versionMismatch,
  showUsage = false,
}: ComparisonSideSummaryProps) {
  const { Link, paths } = useLinkComponent();
  const { isMetricVisible } = useCompareMetricPreferences();

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
        ...(experiment.datasetId && experiment.datasetVersion != null
          ? [
              {
                id: 'dataset-version',
                icon: <HistoryIcon />,
                label: 'Dataset version',
                value: (
                  <ComparisonDatasetVersion
                    datasetId={experiment.datasetId}
                    version={experiment.datasetVersion}
                    differsFromBaseline={versionMismatch}
                  />
                ),
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

  const usage = showUsage ? metrics : undefined;

  const summaryMetrics: ComparisonMetric[] = [
    ...(usage
      ? [
          {
            id: 'total-cost',
            icon: <CoinsIcon />,
            label: 'Total cost',
            value: formatCostValue(usage.cost, usage.costUnit),
            rawValue: usage.cost,
            delta: usage.costUnit === baselineMetrics?.costUnit ? trend(usage.cost, baselineMetrics?.cost) : null,
            formatDelta: costDeltaFormatter(usage.costUnit),
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
            rawValue: metrics.averageDurationMs,
            delta: trend(metrics.averageDurationMs, baselineMetrics?.averageDurationMs),
            formatDelta: formatDurationDelta,
            higherIsBetter: false,
            emphasis: true,
          },
        ]
      : []),
    // Every column lists the same scorers, so hiding it when there are none keeps the columns aligned.
    ...(metrics && summary && summary.length > 0
      ? [
          {
            id: 'avg-score',
            icon: <GaugeIcon />,
            label: 'Avg score',
            value: formatScore(metrics.averageScore),
            rawValue: metrics.averageScore,
            delta: trend(metrics.averageScore, baselineMetrics?.averageScore),
            emphasis: true,
          },
        ]
      : []),
    ...(usage
      ? [
          {
            id: 'total-tokens',
            icon: <HashIcon />,
            label: 'Total tokens',
            value: formatTokenCount(usage.tokens),
            rawValue: usage.tokens,
            delta: trend(usage.tokens, baselineMetrics?.tokens),
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
        ]
      : []),
    ...(summary ?? []).map(({ scorerId, average, delta, labelCounts }) => ({
      id: `scorer:${scorerId}`,
      icon: <ScorersIcon />,
      label: <ScorerLabel scorerId={scorerId} />,
      value:
        labelCounts && Object.keys(labelCounts).length > 0 ? (
          <span className="flex flex-col items-end">
            {formatScore(average)}
            <ScoreLabelCounts counts={labelCounts} className="text-muted-foreground" />
          </span>
        ) : (
          formatScore(average)
        ),
      rawValue: average,
      delta: isContender ? delta : null,
    })),
  ];

  const visibleMetrics = summaryMetrics.filter(metric => isMetricVisible(metric.id));
  if (visibleMetrics.length === 0) return null;

  return (
    <ComparisonSection title="Summary" collapsible={false}>
      <ComparisonMetricList metrics={visibleMetrics} />
    </ComparisonSection>
  );
}
