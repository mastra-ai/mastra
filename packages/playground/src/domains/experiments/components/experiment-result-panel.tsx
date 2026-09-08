'use client';

import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { format } from 'date-fns/format';
import { ClipboardCheck, ExternalLinkIcon, FileCodeIcon, FileOutputIcon, TargetIcon, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ExperimentResultsTagPicker } from './experiment-results-tag-picker';
import { ToolMockReportSection } from './tool-mock-report-section';
import { ComputedTag } from '@/domains/observability/components/computed-tag';

export type ExperimentResultPanelProps = {
  result: DatasetExperimentResult;
  scores?: ClientScoreRowData[];
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onShowTrace?: () => void;
  /** When provided, the "Open in Review" button appears for `needs-review` results. */
  onOpenInReview?: () => void;
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
};

export function ExperimentResultPanel({
  result,
  scores,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  onOpenInReview,
  onScoreClick,
  featuredScoreId,
  onFlagForReview,
  collapsed = false,
  scorePanelSlot,
  onTagsChange,
  tagVocabulary = [],
  isUpdatingTags = false,
}: ExperimentResultPanelProps) {
  const hasError = Boolean(result?.error);
  const inputStr = formatValue(result?.input);
  const outputStr = formatValue(result?.output);
  const groundTruthStr = formatValue(result?.groundTruth);
  const canFlag = onFlagForReview && result.status !== 'needs-review' && result.status !== 'complete';
  const tags = Array.isArray(result.tags) ? result.tags : [];
  const selectedResults = useMemo(() => [result], [result]);
  const showTagsRow = Boolean(onTagsChange) || tags.length > 0;

  return (
    <DataPanel collapsed={collapsed}>
      <DataPanel.Header>
        <DataPanel.Heading>
          Result <b># {result.id.length > 12 ? `${result.id.slice(0, 12)}…` : result.id}</b>
        </DataPanel.Heading>
        <ButtonsGroup className="ml-auto shrink-0">
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Previous result"
            nextLabel="Next result"
          />
          {result.traceId && (
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
          {result.status === 'needs-review' && onOpenInReview && (
            <Button size="md" variant="primary" onClick={onOpenInReview}>
              <ExternalLinkIcon />
              Review
            </Button>
          )}
          <DataPanel.CloseButton onClick={onClose} tooltip="Close result panel" />
        </ButtonsGroup>
      </DataPanel.Header>

      {!collapsed && (
        <SplitWithScorePanel scorePanelSlot={scorePanelSlot}>
          <DataPanel.Content>
            <div className="mb-6 grid gap-4">
              <DataKeysAndValues>
                <DataKeysAndValues.Key>Item Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Item Id to clipboard" copyValue={result.itemId}>
                  {result.itemId}
                </DataKeysAndValues.ValueWithCopyBtn>
                <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </DataKeysAndValues.Value>
                {result.status && (
                  <>
                    <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>
                      <Badge
                        size="xs"
                        variant={
                          result.status === 'needs-review'
                            ? 'orange'
                            : result.status === 'complete'
                              ? 'green'
                              : 'neutral'
                        }
                      >
                        {result.status}
                      </Badge>
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
                                className="rounded-sm hover:opacity-70 disabled:opacity-50"
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
                  {scores.map(score => (
                    <DataList.RowButton
                      key={score.id}
                      featured={featuredScoreId === score.id}
                      onClick={() => onScoreClick?.(score.id)}
                    >
                      <DataList.Cell>{score.scorerId}</DataList.Cell>
                      <DataList.TextCell font="mono">{score.score.toFixed(3)}</DataList.TextCell>
                    </DataList.RowButton>
                  ))}
                </DataList>
              )}

              {result.toolMockReport && <ToolMockReportSection report={result.toolMockReport} />}
            </div>

            <div className="grid gap-3">
              <DataPanel.CodeSection title="Input" icon={<FileCodeIcon />} codeStr={inputStr} />
              <DataPanel.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />
              <DataPanel.CodeSection title="Ground Truth" icon={<TargetIcon />} codeStr={groundTruthStr} />
            </div>
          </DataPanel.Content>
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
