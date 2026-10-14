import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';
import { ClockIcon, CoinsIcon, HashIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  costDeltaFormatter,
  formatCostValue,
  formatDurationDelta,
  formatScore,
  formatTokenCount,
  totalTokens,
} from './comparison-metric-format';
import { ScorerLabel } from './comparison-metric-list';
import type { ComparisonMetric } from './comparison-metric-list';
import { ScoreReasonHoverCard } from './score-reason-hover-card';

export interface ItemMetricScore {
  scorerId: string;
  value: number | null;
  /** Difference against the baseline. Omitted outside of a comparison. */
  delta?: number | null;
  /** Replaces the default scorer link, e.g. with a button opening the score. */
  label?: ReactNode;
  /** Explanation from the scorer, shown in a hover card next to the value. */
  reason?: string | null;
}

export interface ItemMetricsParams {
  usage?: ExperimentItemUsage;
  /** Shows the cost and tokens lines. False when the observability storage cannot serve metrics. */
  showUsage: boolean;
  durationMs: number | null;
  costDelta?: number;
  tokenDelta?: number;
  durationDeltaMs?: number | null;
  scores: ItemMetricScore[];
}

/** Measurable lines of one experiment item, in reading order: Cost, Duration, Tokens, then one line per scorer. */
export function itemMetrics({
  usage,
  showUsage,
  durationMs,
  costDelta,
  tokenDelta,
  durationDeltaMs,
  scores,
}: ItemMetricsParams): ComparisonMetric[] {
  const costUnit = usage?.costUnit;
  const cost: ComparisonMetric[] = showUsage
    ? [
        {
          id: 'cost',
          icon: <CoinsIcon />,
          label: 'Cost',
          value: formatCostValue(usage?.estimatedCost, costUnit),
          delta: costDelta ?? null,
          formatDelta: costDeltaFormatter(costUnit),
          higherIsBetter: false,
        },
      ]
    : [];

  const tokens: ComparisonMetric[] = showUsage
    ? [
        {
          id: 'tokens',
          icon: <HashIcon />,
          label: 'Tokens',
          value: formatTokenCount(totalTokens(usage)),
          delta: tokenDelta ?? null,
          formatDelta: formatTokenCount,
          higherIsBetter: false,
        },
      ]
    : [];

  const duration: ComparisonMetric[] =
    durationMs == null
      ? []
      : [
          {
            id: 'duration',
            icon: <ClockIcon />,
            label: 'Duration',
            value: formatDuration(durationMs) ?? '-',
            delta: durationDeltaMs ?? null,
            formatDelta: formatDurationDelta,
            higherIsBetter: false,
          },
        ];

  return [
    ...cost,
    ...duration,
    ...tokens,
    ...scores.map(score => ({
      id: `scorer:${score.scorerId}`,
      icon: <ScorersIcon />,
      label: score.label ?? <ScorerLabel scorerId={score.scorerId} />,
      value: score.reason?.trim() ? (
        <span className="flex items-center gap-1.5">
          {formatScore(score.value)}
          <ScoreReasonHoverCard scorerId={score.scorerId} reason={score.reason} />
        </span>
      ) : (
        formatScore(score.value)
      ),
      delta: score.delta ?? null,
    })),
  ];
}
