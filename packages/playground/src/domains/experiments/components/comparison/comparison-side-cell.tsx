import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { ClockIcon, CoinsIcon, HashIcon } from 'lucide-react';
import { getResultErrorMessage, getResultOutputText } from '../../utils/result-output';
import { sideDurationMs } from './build-comparison-rows';
import type { ComparisonColumn } from './build-comparison-rows';
import {
  costDeltaFormatter,
  formatCostValue,
  formatDurationDelta,
  formatScore,
  formatTokenCount,
  totalTokens,
} from './comparison-metric-format';
import { ComparisonMetricList, ScorerLabel } from './comparison-metric-list';
import type { ComparisonMetric } from './comparison-metric-list';
import { ComparisonPayload } from './comparison-payload';
import { ComparisonSection, sectionStackClass } from './comparison-section';

export interface ComparisonSideCellProps {
  /** One experiment's side of the row. Contenders carry their deltas against the baseline. */
  column: ComparisonColumn;
  isLoading?: boolean;
  /** Shows the cost and tokens lines. False when the observability storage cannot serve metrics. */
  showUsage?: boolean;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function sideMetrics(side: ComparisonColumn, showUsage: boolean): ComparisonMetric[] {
  const costUnit = side.usage?.costUnit ?? null;
  const cost: ComparisonMetric[] = showUsage
    ? [
        {
          id: 'cost',
          icon: <CoinsIcon />,
          label: 'Cost',
          value: formatCostValue(side.usage?.estimatedCost ?? null, costUnit),
          delta: side.costDelta,
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
          value: formatTokenCount(totalTokens(side.usage)),
          delta: side.tokenDelta,
          formatDelta: formatTokenCount,
          higherIsBetter: false,
        },
      ]
    : [];

  const durationMs = sideDurationMs(side);
  const duration: ComparisonMetric[] =
    durationMs == null
      ? []
      : [
          {
            id: 'duration',
            icon: <ClockIcon />,
            label: 'Duration',
            value: formatDuration(durationMs) ?? '-',
            delta: side.durationDeltaMs,
            formatDelta: formatDurationDelta,
            higherIsBetter: false,
          },
        ];

  return [
    ...cost,
    ...duration,
    ...tokens,
    ...side.scores.map(score => ({
      id: `scorer:${score.scorerId}`,
      icon: <ScorersIcon />,
      label: <ScorerLabel scorerId={score.scorerId} />,
      value: formatScore(score.value),
      delta: side.deltas?.[score.scorerId] ?? null,
    })),
  ];
}

/**
 * One experiment's side of a single item row. Every column renders the exact same
 * sections in the same order so the row can be read as a visual diff.
 */
export function ComparisonSideCell({ column: data, isLoading, showUsage = false }: ComparisonSideCellProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data.present) {
    return (
      <Txt tone="muted" className="py-5 text-center">
        Not present in this experiment
      </Txt>
    );
  }

  const outputStr = formatValue(data.output);
  const outputText = getResultOutputText(data);
  const errorMessage = getResultErrorMessage(data);
  const metrics = sideMetrics(data, showUsage);

  return (
    <div className={sectionStackClass}>
      {metrics.length > 0 && (
        <ComparisonSection title="Metrics" collapsible={false}>
          <ComparisonMetricList metrics={metrics} />
        </ComparisonSection>
      )}

      {errorMessage ? (
        <ComparisonSection title="Error" tone="negative" actions={<CopyButton content={errorMessage} />}>
          <Txt tone="muted" className="rounded-lg border border-destructive-edge bg-destructive-subtle p-3 break-words">
            {errorMessage}
          </Txt>
        </ComparisonSection>
      ) : (
        <ComparisonSection title="Output" actions={<CopyButton content={outputStr} />}>
          <ComparisonPayload value={outputText ?? data.output} />
        </ComparisonSection>
      )}

      {data.comment && (
        <ComparisonSection title="Comment">
          <ComparisonPayload value={data.comment} />
        </ComparisonSection>
      )}

      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <ComparisonSection title="Metadata">
          <dl className="grid gap-1">
            {Object.entries(data.metadata).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <dt className={textStyle({ tone: 'muted', variant: 'body' })}>{key}</dt>
                <dd className={cn(textStyle({ tone: 'ink', variant: 'body', font: 'mono' }), 'break-all')}>
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </ComparisonSection>
      )}
    </div>
  );
}
