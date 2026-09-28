'use client';

import type { DatasetExperimentResult } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { formatCompactNumber, formatCost } from '@mastra/playground-ui/utils/cost';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { CheckCircle, ClipboardCheck, FlaskConical, FileCodeIcon, FileOutputIcon, TargetIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useExperimentResultUsage } from '../hooks/use-experiment-result-usage';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';
import { ToolMockReportSection } from './tool-mock-report-section';
import { ComputedTag } from '@/domains/observability/components/computed-tag';
import { ReviewStatusBadge } from '@/domains/review/components/review-status-badge';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

/**
 * Structural subset of `DatasetExperimentResult` the panel renders. Review-queue
 * items satisfy it too, so the same panel serves experiments and review flows.
 */
export type ExperimentResultPanelResult = Pick<DatasetExperimentResult, 'id' | 'itemId' | 'input' | 'output'> &
  Partial<Pick<DatasetExperimentResult, 'createdAt' | 'status' | 'groundTruth' | 'toolMockReport' | 'traceId'>> & {
    error?: unknown;
    tags?: string[] | null;
  };

export type ExperimentResultPanelScore = { id: string; scorerId: string; score: number };

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
};

export function ExperimentResultPanel({
  result,
  itemId,
  fallback,
  title,
  onClose,
  ...bodyProps
}: ExperimentResultPanelProps) {
  const dialogTitle = title ?? (itemId ? `Experiment item ${itemId}` : `Result ${result?.id ?? ''}`);
  return (
    <DataPanel open={!!(result ?? itemId)} onClose={onClose} title={dialogTitle} depth={1} size="half">
      {result ? (
        <ExperimentResultPanelBody result={result} onClose={onClose} {...bodyProps} />
      ) : itemId ? (
        <>
          <DataPanel.Header>
            <DataPanel.CloseButton onClick={onClose} tooltip="Close result panel" />
            <DataPanel.Heading>
              Experiment item
              <DataPanel.CopyId id={itemId} />
            </DataPanel.Heading>
          </DataPanel.Header>
          {fallback}
        </>
      ) : null}
    </DataPanel>
  );
}

type ExperimentResultPanelBodyProps = Omit<ExperimentResultPanelProps, 'result' | 'itemId' | 'fallback'> & {
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
              <DataKeysAndValues.Value>{formatDate(result.createdAt, 'date-time')}</DataKeysAndValues.Value>
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
                {usage.inputTokens !== undefined ? formatCompactNumber(usage.inputTokens) : '—'}
              </DataKeysAndValues.Value>
              <DataKeysAndValues.Key>Output tokens</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {usage.outputTokens !== undefined ? formatCompactNumber(usage.outputTokens) : '—'}
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
    <>
      <DataPanel.Header>
        <DataPanel.CloseButton onClick={onClose} tooltip="Close result panel" />
        <DataPanel.Heading>
          Result
          <DataPanel.CopyId id={result.id} />
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          {canFlag && (
            <Button size="sm" variant="primary" onClick={() => onFlagForReview!(result.id)} icon={<ClipboardCheck />}>
              Flag for Review
            </Button>
          )}
          {onComplete && result.status === 'needs-review' && (
            <Button size="sm" variant="primary" onClick={onComplete} icon={<CheckCircle />}>
              Mark as reviewed
            </Button>
          )}
          {experimentLink && (
            <Button
              size="sm"
              variant="ghost"
              render={<Link href={experimentLink} />}
              tooltip="See experiment"
              aria-label="See experiment"
            >
              <FlaskConical />
            </Button>
          )}
          {result.traceId && onShowTrace && (
            <Button size="sm" variant="ghost" onClick={onShowTrace} tooltip="See trace" aria-label="See trace">
              <TraceIcon />
            </Button>
          )}
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Go to previous result"
            nextLabel="Go to next result"
          />
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

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
