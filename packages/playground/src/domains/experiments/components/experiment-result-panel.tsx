'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { formatCompact, formatCost } from '@mastra/playground-ui/domains/metrics/components/metrics-utils';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { format } from 'date-fns/format';
import { CheckCircle, ClipboardCheck, FlaskConical, FileCodeIcon, FileOutputIcon, TargetIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useExperimentResultUsage } from '../hooks/use-experiment-result-usage';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';
import { ToolMockReportSection } from './tool-mock-report-section';
import { ComputedTag } from '@/domains/observability/components/computed-tag';
import { ReviewStatusBadge } from '@/domains/review/components/review-status-badge';
import { NeedsReviewDot } from '@/domains/traces/components/needs-review-dot';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { useLinkComponent } from '@/lib/framework';

/**
 * Structural subset of `DatasetExperimentResult` the panel renders. Review-queue
 * items satisfy it too, so the same panel serves experiments and review flows.
 */
export type ExperimentResultPanelResult = Pick<DatasetExperimentResult, 'id' | 'itemId' | 'input' | 'output'> &
  Partial<Pick<DatasetExperimentResult, 'createdAt' | 'status' | 'groundTruth' | 'toolMockReport' | 'traceId'>> & {
    error?: unknown;
    tags: string[] | null;
  };

export type ExperimentResultPanelScore = { id: string; scorerId: string; score: number };

export type ExperimentResultPanelProps = {
  result: ExperimentResultPanelResult;
  scores?: ExperimentResultPanelScore[];
  className?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onShowTrace?: () => void;
  onScoreClick?: (scoreId: string) => void;
  featuredScoreId?: string | null;
  onFlagForReview?: (resultId: string) => void;
  /** Controlled collapsed state used when opening related trace details. */
  collapsed?: boolean;
  /**
   * When provided, the panel splits into two columns inside the same card: the
   * result content on the left, this slot (typically the score detail) on the right.
   */
  scorePanelSlot?: ReactNode;
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
};

export function ExperimentResultPanel({
  result,
  scores,
  className,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  onScoreClick,
  featuredScoreId,
  onFlagForReview,
  collapsed = false,
  scorePanelSlot,
  onTagsChange,
  tagVocabulary = [],
  isUpdatingTags = false,
  experimentLink,
  onComplete,
  feedbackTabSlot,
}: ExperimentResultPanelProps) {
  const hasError = Boolean(result?.error);
  const inputStr = formatValue(result?.input);
  const outputStr = formatValue(result?.output);
  const groundTruthStr = formatValue(result?.groundTruth);
  const canFlag = onFlagForReview && result.status !== 'needs-review' && result.status !== 'complete';
  const tags = Array.isArray(result.tags) ? result.tags : [];
  const selectedResults = useMemo(() => [result], [result]);
  const showTagsRow = Boolean(onTagsChange) || tags.length > 0;
  const { Link } = useLinkComponent();
  const feedbackTraceId = feedbackTabSlot && result.traceId ? result.traceId : undefined;
  // Fetched as soon as the panel opens so the tab can flag feedback still needing review.
  const { data: traceFeedback } = useTraceFeedback({ traceId: feedbackTraceId });
  const usage = useExperimentResultUsage(result.traceId);

  const details = (
    <DataPanel.Content>
      <div className="mb-6 grid gap-4">
        <DataKeysAndValues>
          <DataKeysAndValues.Key>Item Id</DataKeysAndValues.Key>
          <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Item Id to clipboard" copyValue={result.itemId}>
            {result.itemId}
          </DataKeysAndValues.ValueWithCopyBtn>
          {result.createdAt && (
            <>
              <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </DataKeysAndValues.Value>
            </>
          )}
          {result.status && (
            <>
              <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                <ReviewStatusBadge status={result.status} />
              </DataKeysAndValues.Value>
            </>
          )}
          {showTagsRow && (
            <>
              <DataKeysAndValues.Key>Tags</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                <div className="flex flex-wrap items-center gap-1.5">
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
                      appearance="inline"
                      selectedResults={selectedResults}
                      vocabulary={tagVocabulary}
                      onAddTag={tag => onTagsChange([...tags, tag])}
                      disabled={isUpdatingTags}
                    />
                  )}
                </div>
              </DataKeysAndValues.Value>
            </>
          )}
          {usage && (
            <>
              <DataKeysAndValues.Key>Input tokens</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {usage.inputTokens !== undefined ? formatCompact(usage.inputTokens) : '—'}
              </DataKeysAndValues.Value>
              <DataKeysAndValues.Key>Output tokens</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {usage.outputTokens !== undefined ? formatCompact(usage.outputTokens) : '—'}
              </DataKeysAndValues.Value>
              <DataKeysAndValues.Key>Cost</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {usage.estimatedCost !== undefined ? formatCost(usage.estimatedCost, usage.costUnit) : '—'}
              </DataKeysAndValues.Value>
            </>
          )}
        </DataKeysAndValues>

        {hasError && (
          <Notice variant="destructive" title="Error">
            <Notice.Message>
              {formatValue(
                result?.error && typeof result.error === 'object'
                  ? (result.error as Record<string, unknown>).message
                  : result?.error,
              )}
            </Notice.Message>
          </Notice>
        )}

        {scores && scores.length > 0 && (
          <DataList columns="1fr 1fr">
            <DataList.Top>
              <DataList.TopCell>Scorer</DataList.TopCell>
              <DataList.TopCell>Score</DataList.TopCell>
            </DataList.Top>
            {scores.map(score =>
              onScoreClick ? (
                <DataList.RowButton
                  key={score.id}
                  featured={featuredScoreId === score.id}
                  onClick={() => onScoreClick(score.id)}
                >
                  <DataList.Cell>{score.scorerId}</DataList.Cell>
                  <DataList.TextCell font="mono">{score.score.toFixed(3)}</DataList.TextCell>
                </DataList.RowButton>
              ) : (
                <DataList.RowStatic key={score.id}>
                  <DataList.Cell>{score.scorerId}</DataList.Cell>
                  <DataList.TextCell font="mono">{score.score.toFixed(3)}</DataList.TextCell>
                </DataList.RowStatic>
              ),
            )}
          </DataList>
        )}

        {result.toolMockReport && <ToolMockReportSection report={result.toolMockReport} />}
      </div>

      <div className="grid gap-3">
        <DataPanel.CodeSection title="Input" icon={<FileCodeIcon />} codeStr={inputStr} />
        <DataPanel.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />
        {result.groundTruth !== undefined && (
          <DataPanel.CodeSection title="Ground Truth" icon={<TargetIcon />} codeStr={groundTruthStr} />
        )}
      </div>
    </DataPanel.Content>
  );

  return (
    <DataPanel collapsed={collapsed} className={className}>
      {/* Actions may wrap on narrow panels; the close button sits outside the group so it stays on the first row. */}
      <DataPanel.Header className="items-start">
        <DataPanel.Heading className="shrink-0 self-center whitespace-nowrap">
          Result <b># {result.id.length > 12 ? `${result.id.slice(0, 12)}…` : result.id}</b>
        </DataPanel.Heading>
        <ButtonsGroup className="ml-auto flex-wrap justify-end">
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Previous result"
            nextLabel="Next result"
          />
          {experimentLink && (
            <Button size="md" as={Link} to={experimentLink}>
              <FlaskConical />
              See experiment
            </Button>
          )}
          {result.traceId && onShowTrace && (
            <Button size="md" onClick={onShowTrace}>
              <TraceIcon />
              Trace
            </Button>
          )}
          {canFlag && (
            <Button size="md" variant="primary" onClick={() => onFlagForReview!(result.id)}>
              <ClipboardCheck />
              Flag for Review
            </Button>
          )}
          {onComplete && result.status === 'needs-review' && (
            <Button size="md" variant="primary" onClick={onComplete}>
              <CheckCircle />
              Mark as reviewed
            </Button>
          )}
        </ButtonsGroup>
        <DataPanel.CloseButton onClick={onClose} tooltip="Close result panel" className="shrink-0" />
      </DataPanel.Header>

      {!collapsed && (
        <SplitWithScorePanel scorePanelSlot={scorePanelSlot}>
          {feedbackTraceId ? (
            <Tabs<'details' | 'feedback'> defaultTab="details" className="grid h-full min-h-0 grid-rows-[auto_1fr]">
              <DataPanel.Header className="py-2">
                <TabList variant="pill-ghost" className="px-0">
                  <Tab value="details">Details</Tab>
                  <Tab value="feedback">
                    Feedback
                    <NeedsReviewDot feedback={traceFeedback?.feedback} />
                  </Tab>
                </TabList>
              </DataPanel.Header>
              <TabContent value="details" className="min-h-0 py-0">
                {details}
              </TabContent>
              <TabContent value="feedback" className="h-full min-h-0 py-0">
                <DataPanel.Content>{feedbackTabSlot!({ traceId: feedbackTraceId })}</DataPanel.Content>
              </TabContent>
            </Tabs>
          ) : (
            details
          )}
        </SplitWithScorePanel>
      )}
    </DataPanel>
  );
}

/**
 * Renders the result content as-is, or — when a score panel is provided — as a
 * two-column split inside the same card, with the score detail on the right.
 * Mirrors `SplitWithSpanPanel` from the traces domain.
 */
function SplitWithScorePanel({ scorePanelSlot, children }: { scorePanelSlot?: ReactNode; children: ReactNode }) {
  if (!scorePanelSlot) return <>{children}</>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr]">
      <div className="flex min-h-0 flex-col overflow-hidden">{children}</div>
      <div className="animate-in border-border1 fade-in-0 flex min-h-0 flex-col overflow-hidden border-l duration-300">
        {scorePanelSlot}
      </div>
    </div>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
