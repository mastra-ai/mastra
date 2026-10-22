import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { getResultErrorMessage, getResultOutputText } from '../../utils/result-output';
import { sideAverageScore, sideDurationMs } from './build-comparison-rows';
import type { ComparisonColumn } from './build-comparison-rows';
import { ComparisonMetricList } from './comparison-metric-list';
import type { ComparisonMetric } from './comparison-metric-list';
import { ComparisonPayload } from './comparison-payload';
import { ComparisonSection, sectionStackClass } from './comparison-section';
import { itemMetrics } from './item-metrics';
import { useCompareMetricPreferences } from './use-compare-metric-preferences';

export interface ComparisonSideCellProps {
  /** One experiment's side of the row. Contenders carry their deltas against the baseline. */
  column: ComparisonColumn;
  isLoading?: boolean;
  /** Shows the cost and tokens lines. False when the observability storage cannot serve metrics. */
  showUsage?: boolean;
  /** Shared by every output of the row, so expanding one expands them all. */
  outputExpanded?: boolean;
  onOutputExpandedChange?: (expanded: boolean) => void;
  /** Opens the trace of this side's run. The button only shows when the run has a trace. */
  onShowTrace?: (traceId: string) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function sideMetrics(side: ComparisonColumn, showUsage: boolean): ComparisonMetric[] {
  return itemMetrics({
    usage: side.usage,
    showUsage,
    durationMs: sideDurationMs(side),
    costDelta: side.costDelta,
    tokenDelta: side.tokenDelta,
    durationDeltaMs: side.durationDeltaMs,
    averageScore: side.scores.length > 0 ? { value: sideAverageScore(side), delta: side.averageScoreDelta } : undefined,
    scores: side.scores.map(score => ({
      scorerId: score.scorerId,
      value: score.value,
      reason: score.reason,
      scoreLabel: score.label,
      delta: side.deltas?.[score.scorerId] ?? null,
    })),
  });
}

/**
 * One experiment's side of a single item row. Every column renders the exact same
 * sections in the same order so the row can be read as a visual diff.
 */
export function ComparisonSideCell({
  column: data,
  isLoading,
  showUsage = false,
  outputExpanded,
  onOutputExpandedChange,
  onShowTrace,
}: ComparisonSideCellProps) {
  const { isMetricVisible } = useCompareMetricPreferences();

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
  const metrics = sideMetrics(data, showUsage).filter(metric => isMetricVisible(metric.id));
  const { traceId } = data;
  const traceAction =
    traceId && onShowTrace ? (
      <Button
        size="sm"
        variant="ghost"
        tooltip="View trace"
        aria-label="View trace"
        onClick={() => onShowTrace(traceId)}
      >
        <TraceIcon />
      </Button>
    ) : undefined;
  const hasMetrics = metrics.length > 0;
  // With every metric hidden the Metrics section goes away, so the trace action joins Copy.
  const resultActions = (content: string) => (
    <>
      {!hasMetrics && traceAction}
      <CopyButton content={content} size="sm" variant="ghost" />
    </>
  );

  return (
    <div className={sectionStackClass}>
      {hasMetrics && (
        <ComparisonSection title="Metrics" collapsible={false} actions={traceAction}>
          <ComparisonMetricList metrics={metrics} />
        </ComparisonSection>
      )}

      {errorMessage ? (
        <ComparisonSection title="Error" tone="negative" framed actions={resultActions(errorMessage)}>
          <Txt tone="muted" className="p-3 break-words">
            {errorMessage}
          </Txt>
        </ComparisonSection>
      ) : (
        <ComparisonSection
          title="Output"
          framed
          actions={resultActions(outputStr)}
          expanded={outputExpanded}
          onExpandedChange={onOutputExpandedChange}
        >
          <ComparisonPayload value={outputText ?? data.output} />
        </ComparisonSection>
      )}

      {data.comment && (
        <ComparisonSection title="Comment" framed>
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
