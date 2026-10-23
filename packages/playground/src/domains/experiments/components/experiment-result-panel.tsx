'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ReviewStatusBadge } from '@mastra/playground-ui/domains/review/components/review-status-badge';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { getShortId } from '@mastra/playground-ui/utils/id';
import { useTraceFeedback } from '@mastra/react/hooks/traces';
import {
  CalendarIcon,
  CheckCircle,
  CircleDotIcon,
  ClipboardPlus,
  FingerprintIcon,
  FlaskConical,
  TagIcon,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useExperimentResultUsage } from '../hooks/use-experiment-result-usage';
import { getResultErrorMessage, getResultOutputText } from '../utils/result-output';
import { sideDurationMs } from './comparison/build-comparison-rows';
import { ComparisonMetricList } from './comparison/comparison-metric-list';
import type { ComparisonMetric } from './comparison/comparison-metric-list';
import { ComparisonPayload } from './comparison/comparison-payload';
import { ComparisonSection, sectionStackClass } from './comparison/comparison-section';
import { itemMetrics } from './comparison/item-metrics';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';
import { ToolMockReportSection } from './tool-mock-report-section';
import { ComputedTag } from '@/domains/observability/components/computed-tag';

/**
 * Structural subset of `DatasetExperimentResult` the panel renders. Review-queue
 * items satisfy it too, so the same panel serves experiments and review flows.
 */
export type ExperimentResultPanelResult = Pick<DatasetExperimentResult, 'id' | 'itemId' | 'input' | 'output'> &
  Partial<
    Pick<
      DatasetExperimentResult,
      'targetType' | 'createdAt' | 'startedAt' | 'completedAt' | 'status' | 'groundTruth' | 'toolMockReport' | 'traceId'
    >
  > & {
    error?: unknown;
    tags?: string[] | null;
  };

export type ExperimentResultPanelScore = { id: string; scorerId: string; score: number; reason?: string | null };

export type ExperimentResultPanelProps = {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  result?: ExperimentResultPanelResult;
  /** Item the panel is opened for while `result` is not available yet; keeps the drawer open showing `fallback`. */
  itemId?: string;
  /** Rendered instead of the result body while `itemId` is set but `result` is missing (loading / not found). */
  fallback?: ReactNode;
  /** Accessible dialog name. Defaults to `Experiment item <itemId>` when opened by item, else `Result <id>`. */
  title?: string;
  scores?: ExperimentResultPanelScore[];
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onShowTrace?: () => void;
  onScoreClick?: (scoreId: string) => void;
  featuredScoreId?: string | null;
  onFlagForReview?: (resultId: string) => void;
  /** When provided, tags become editable in the metadata block (add via picker, remove via badge). */
  onTagsChange?: (tags: string[]) => void;
  /** Known tags offered by the tag picker. */
  tagVocabulary?: string[];
  isUpdatingTags?: boolean;
  /** Link to the experiment that produced this result; renders a "See experiment" header action. */
  experimentLink?: string;
  /** Renders a "Mark as reviewed" header action for `needs-review` results. */
  onComplete?: () => void | Promise<void>;
  /**
   * When provided (and the result has a trace), the body splits into Details and
   * Feedback tabs; this renders the feedback tab, keyed by trace id.
   */
  feedbackTabSlot?: (args: { traceId: string }) => ReactNode;
  /**
   * `drawer` (default) portals the panel over the app. `inline` renders it in the document flow
   * (e.g. inside the route side panel) and renders nothing while there is no `result`/`itemId`.
   */
  variant?: 'drawer' | 'inline';
};

export function ExperimentResultPanel({
  result,
  itemId,
  fallback,
  title,
  onClose,
  variant = 'drawer',
  ...bodyProps
}: ExperimentResultPanelProps) {
  const dialogTitle = title ?? (itemId ? `Experiment item ${itemId}` : `Experiment result ${result?.id ?? ''}`);
  const content = result ? (
    <ExperimentResultPanelBody result={result} onClose={onClose} {...bodyProps} />
  ) : itemId ? (
    <>
      <DataPanel.Header>
        <DataPanel.Heading>
          Experiment item
          <DataPanel.CopyId id={itemId} />
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" onClick={onClose} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      {fallback}
    </>
  ) : null;

  if (variant === 'inline') {
    if (!content) return null;
    return (
      <DataPanel variant="inline" title={dialogTitle}>
        {content}
      </DataPanel>
    );
  }

  return (
    <DataPanel open={!!(result ?? itemId)} onClose={onClose} title={dialogTitle} depth={1}>
      {content}
    </DataPanel>
  );
}

type ExperimentResultPanelBodyProps = Omit<ExperimentResultPanelProps, 'result' | 'itemId' | 'fallback' | 'variant'> & {
  result: ExperimentResultPanelResult;
};

function ExperimentResultPanelBody({
  result,
  scores,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  onScoreClick,
  featuredScoreId,
  onFlagForReview,
  onTagsChange,
  tagVocabulary = [],
  isUpdatingTags = false,
  experimentLink,
  onComplete,
  feedbackTabSlot,
}: ExperimentResultPanelBodyProps) {
  const inputStr = formatValue(result.input);
  const outputStr = formatValue(result.output);
  const outputText = getResultOutputText(result);
  const canFlag = onFlagForReview && result.status !== 'needs-review' && result.status !== 'complete';
  const tags = Array.isArray(result.tags) ? result.tags : [];
  const selectedResults = useMemo(() => [result], [result]);
  const showTagsRow = Boolean(onTagsChange) || tags.length > 0;
  const { Link } = useLinkComponent();
  const feedbackTraceId = feedbackTabSlot && result.traceId ? result.traceId : undefined;
  // Fetched as soon as the panel opens so the tab can flag feedback still needing review.
  const { data: traceFeedback } = useTraceFeedback({
    traceId: feedbackTraceId,
    queryOptions: { enabled: !!feedbackTraceId },
  });
  const { usage, isLoading: isUsageLoading } = useExperimentResultUsage(result.traceId);
  // Only agent runs report usage: reserve its rows while loading so the panel doesn't shift once it lands.
  const isUsagePending = isUsageLoading && (result.targetType == null || result.targetType === 'agent');
  const usageMetrics = itemMetrics({
    usage,
    showUsage: !!usage || isUsagePending,
    durationMs: sideDurationMs(result),
    scores: [],
  }).map(metric =>
    isUsagePending && (metric.id === 'cost' || metric.id === 'tokens')
      ? { ...metric, value: <Skeleton aria-hidden className="h-4 w-14" /> }
      : metric,
  );

  const errorMessage = typeof result.error === 'string' && result.error ? result.error : getResultErrorMessage(result);
  const metrics: ComparisonMetric[] = [
    ...usageMetrics,
    {
      id: 'item-id',
      icon: <FingerprintIcon />,
      label: 'Item Id',
      value: (
        <span className="flex items-center gap-1.5">
          <span className="font-mono" title={result.itemId}>
            {getShortId(result.itemId)}
          </span>
          <CopyButton content={result.itemId} tooltip="Copy item ID to clipboard" variant="link" />
        </span>
      ),
      delta: null,
    },
    ...(result.createdAt
      ? [
          {
            id: 'created',
            icon: <CalendarIcon />,
            label: 'Created',
            value: formatDate(result.createdAt, 'date-time'),
            delta: null,
          },
        ]
      : []),
    ...(result.status
      ? [
          {
            id: 'status',
            icon: <CircleDotIcon />,
            label: 'Status',
            value: <ReviewStatusBadge status={result.status} />,
            delta: null,
          },
        ]
      : []),
    ...(showTagsRow
      ? [
          {
            id: 'tags',
            icon: <TagIcon />,
            label: 'Tags',
            value: (
              <ResultTags
                tags={tags}
                selectedResults={selectedResults}
                onTagsChange={onTagsChange}
                tagVocabulary={tagVocabulary}
                isUpdatingTags={isUpdatingTags}
              />
            ),
            delta: null,
          },
        ]
      : []),
    ...itemMetrics({
      showUsage: false,
      durationMs: null,
      scores: (scores ?? []).map(score => ({
        scorerId: score.scorerId,
        value: score.score,
        reason: score.reason,
        label: onScoreClick ? (
          <ScoreButton
            scorerId={score.scorerId}
            featured={featuredScoreId === score.id}
            onClick={() => onScoreClick(score.id)}
          />
        ) : undefined,
      })),
    }),
  ];

  const details = (
    <DataPanel.Content>
      <div className={sectionStackClass}>
        <ComparisonMetricList metrics={metrics} />

        <ComparisonSection title="Input" framed actions={<CopyButton content={inputStr} />}>
          <ComparisonPayload value={result.input} />
        </ComparisonSection>

        {result.groundTruth != null && (
          <ComparisonSection
            title="Ground Truth"
            framed
            actions={<CopyButton content={formatValue(result.groundTruth)} />}
          >
            <ComparisonPayload value={result.groundTruth} />
          </ComparisonSection>
        )}

        {errorMessage ? (
          <ComparisonSection title="Error" tone="negative" framed actions={<CopyButton content={errorMessage} />}>
            <Txt tone="muted" className="p-3 break-words">
              {errorMessage}
            </Txt>
          </ComparisonSection>
        ) : (
          <ComparisonSection title="Output" framed actions={<CopyButton content={outputStr} />}>
            <ComparisonPayload value={outputText ?? result.output} />
          </ComparisonSection>
        )}

        {result.toolMockReport && <ToolMockReportSection report={result.toolMockReport} />}
      </div>
    </DataPanel.Content>
  );

  return (
    <>
      <DataPanel.Header>
        {canFlag && (
          <Button size="sm" variant="primary" onClick={() => onFlagForReview(result.id)} icon={<ClipboardPlus />}>
            Request review
          </Button>
        )}
        {onComplete && result.status === 'needs-review' && (
          <Button size="sm" variant="primary" onClick={onComplete} icon={<CheckCircle />}>
            Mark as reviewed
          </Button>
        )}
        <DataPanel.HeaderActions>
          {experimentLink && (
            <Button
              size="icon-sm"
              variant="ghost"
              render={<Link href={experimentLink} />}
              tooltip="See experiment"
              aria-label="See experiment"
            >
              <FlaskConical />
            </Button>
          )}
          {result.traceId && onShowTrace && (
            <Button size="icon-sm" variant="ghost" onClick={onShowTrace} tooltip="See trace" aria-label="See trace">
              <TraceIcon />
            </Button>
          )}
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Go to previous result"
            nextLabel="Go to next result"
          />
          <DataPanel.CloseButton icon="x" onClick={onClose} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>

      {feedbackTraceId ? (
        <Tabs<'details' | 'feedback'> defaultTab="details" className="grid h-full min-h-0 grid-rows-[auto_1fr]">
          <DataPanel.Header>
            <TabList variant="pill-ghost" size="sm">
              <Tab value="details">Details</Tab>
              <Tab value="feedback">
                Feedback{traceFeedback?.pagination?.total != null && <> ({traceFeedback.pagination.total})</>}
              </Tab>
            </TabList>
          </DataPanel.Header>
          <TabContent value="details" flush>
            {details}
          </TabContent>
          <TabContent value="feedback" flush>
            <DataPanel.Content>{feedbackTabSlot!({ traceId: feedbackTraceId })}</DataPanel.Content>
          </TabContent>
        </Tabs>
      ) : (
        details
      )}
    </>
  );
}

/** Scorer key that opens the score in the sibling drawer instead of linking to the scorer page. */
function ScoreButton({ scorerId, featured, onClick }: { scorerId: string; featured: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={featured}
      onClick={onClick}
      className={cn(
        'min-w-0 cursor-pointer truncate hover:text-foreground hover:underline',
        featured && 'text-foreground',
      )}
    >
      {scorerId}
    </button>
  );
}

type ResultTagsProps = {
  tags: string[];
  selectedResults: ExperimentResultPanelResult[];
  onTagsChange?: (tags: string[]) => void;
  tagVocabulary: string[];
  isUpdatingTags: boolean;
};

/** Tag badges; editable (remove via badge, add via picker) when `onTagsChange` is provided. */
function ResultTags({ tags, selectedResults, onTagsChange, tagVocabulary, isUpdatingTags }: ResultTagsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {tags.map(tag => (
        <ComputedTag key={tag} value={tag} className={onTagsChange ? 'gap-1 pr-1' : undefined}>
          {tag}
          {onTagsChange && (
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              disabled={isUpdatingTags}
              onClick={() => onTagsChange(tags.filter(t => t !== tag))}
              className="cursor-pointer rounded-sm hover:opacity-70 disabled:opacity-50"
            >
              <X className="size-3" />
            </button>
          )}
        </ComputedTag>
      ))}
      {onTagsChange && (
        <ExperimentResultsTagPicker
          selectedResults={selectedResults}
          vocabulary={tagVocabulary}
          onAddTag={tag => onTagsChange([...tags, tag])}
          disabled={isUpdatingTags}
          variant="ghost"
        />
      )}
    </div>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
