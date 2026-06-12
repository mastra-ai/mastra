'use client';

import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import {
  Button,
  ButtonsGroup,
  DataKeysAndValues,
  DataList,
  DataPanel,
  Notice,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TraceIcon,
} from '@mastra/playground-ui';
import { format } from 'date-fns/format';
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ClipboardCheck,
  ExternalLinkIcon,
  FileCodeIcon,
  FileOutputIcon,
  RotateCcwIcon,
  TagIcon,
  TargetIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { ReplayTapeSpan, ToolReplayMatching } from '../utils/tool-replay';
import { getToolReplayErrorLabel, getToolReplayReport, stripToolReplayFromOutput } from '../utils/tool-replay';
import { ExperimentResultReplaySection } from './experiment-result-replay-section';

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
  /** Controlled collapsed state. When omitted, the panel manages its own state. */
  collapsed?: boolean;
  /** When provided, the collapse button appears in the header and notifies the parent on toggle. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Gates the replay report section — only replay experiments read output.toolReplay. */
  isReplayExperiment?: boolean;
  /** The run's matching policy (from the experiment marker) — labels the replay section. */
  replayMatching?: ToolReplayMatching;
  onShowSourceTrace?: (traceId: string, spanId?: string) => void;
  /** Light spans of the source trace — enables the FIFO tape view. */
  sourceTraceSpans?: ReplayTapeSpan[];
  /** Same item's result from the replay's source experiment — enables the original-vs-replay output comparison. */
  originalResult?: DatasetExperimentResult | null;
  /** Re-runs this item under the same replay policy and mocks — provided only on replay/mock runs. */
  onReRunWithReplay?: () => void;
  /**
   * When set, the re-run button renders disabled with this tooltip — mock
   * runs whose configs can't be rebuilt from the marker: function mocks
   * (code never persists) or legacy records without persisted mock values.
   */
  reRunDisabledReason?: string;
  /** Pending state of the re-run trigger — guards against double-clicks. */
  isReRunPending?: boolean;
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
  collapsed: controlledCollapsed,
  onCollapsedChange,
  isReplayExperiment,
  replayMatching,
  onShowSourceTrace,
  sourceTraceSpans,
  originalResult,
  onReRunWithReplay,
  reRunDisabledReason,
  isReRunPending,
}: ExperimentResultPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const hasError = Boolean(result?.error);
  // Double gate: experiment-level marker + result-level report shape.
  const replayReport = isReplayExperiment ? getToolReplayReport(result) : null;
  const replayErrorLabel = isReplayExperiment ? getToolReplayErrorLabel(result?.error?.code) : null;
  const inputStr = formatValue(result?.input);
  // The report is rendered in its own section — keep the Output view clean.
  const outputStr = formatValue(replayReport ? stripToolReplayFromOutput(result?.output) : result?.output);
  const groundTruthStr = formatValue(result?.groundTruth);
  // Side-by-side original-vs-replay output: only when this is a replay result
  // (report present) AND the matching source-experiment result is available.
  const showOriginalComparison = Boolean(isReplayExperiment && replayReport && originalResult);
  const canFlag = onFlagForReview && result.status !== 'needs-review' && result.status !== 'complete';
  const tags = Array.isArray(result.tags) ? result.tags : [];

  return (
    <DataPanel collapsed={collapsed}>
      <DataPanel.Header>
        <DataPanel.Heading>
          Result <b># {result.id.length > 12 ? `${result.id.slice(0, 12)}…` : result.id}</b>
        </DataPanel.Heading>
        <ButtonsGroup className="ml-auto shrink-0">
          {onCollapsedChange && (
            <Button
              size="md"
              tooltip={collapsed ? 'Expand panel' : 'Collapse panel'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            </Button>
          )}
          <DataPanel.NextPrevNav
            onPrevious={onPrevious}
            onNext={onNext}
            previousLabel="Previous result"
            nextLabel="Next result"
          />
          {reRunDisabledReason ? (
            // Disabled buttons swallow pointer events, so the tooltip needs the
            // inert-wrapper pattern (same as the dataset page's Run button).
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-not-allowed">
                  <div className="pointer-events-none opacity-50" inert aria-disabled="true">
                    <Button size="md">
                      <RotateCcwIcon />
                      Re-run item with replay
                    </Button>
                  </div>
                </span>
              </TooltipTrigger>
              <TooltipContent>{reRunDisabledReason}</TooltipContent>
            </Tooltip>
          ) : onReRunWithReplay ? (
            <Button size="md" onClick={onReRunWithReplay} disabled={isReRunPending}>
              <RotateCcwIcon />
              Re-run item with replay
            </Button>
          ) : null}
          <Button size="md" onClick={onShowTrace} disabled={!result.traceId}>
            <TraceIcon />
            Trace
          </Button>
          <DataPanel.CloseButton onClick={onClose} tooltip="Close result panel" />
        </ButtonsGroup>
      </DataPanel.Header>

      {!collapsed && (
        <DataPanel.Content>
          <div className="grid gap-4 mb-6">
            <DataKeysAndValues>
              <DataKeysAndValues.Key>Item Id</DataKeysAndValues.Key>
              <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Item Id to clipboard" copyValue={result.itemId}>
                {result.itemId}
              </DataKeysAndValues.ValueWithCopyBtn>
              <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>
                {format(new Date(result.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </DataKeysAndValues.Value>
            </DataKeysAndValues>

            {hasError && (
              <Notice variant="destructive" title={result?.error?.code ? `Error · ${result.error.code}` : 'Error'}>
                <Notice.Message>
                  {formatValue(
                    result?.error && typeof result.error === 'object'
                      ? (result.error as Record<string, unknown>).message
                      : result?.error,
                  )}
                </Notice.Message>
                {replayErrorLabel && <Notice.Message>{replayErrorLabel}</Notice.Message>}
              </Notice>
            )}

            {replayReport && (
              <ExperimentResultReplaySection
                report={replayReport}
                onShowSourceTrace={onShowSourceTrace}
                sourceTraceSpans={sourceTraceSpans}
                matching={replayMatching}
              />
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
                    <DataList.Cell height="compact">{score.scorerId}</DataList.Cell>
                    <DataList.MonoCell>{score.score.toFixed(3)}</DataList.MonoCell>
                  </DataList.RowButton>
                ))}
              </DataList>
            )}

            {(result.status || tags.length > 0 || canFlag) && (
              <div className="grid gap-2">
                <DataPanel.SectionHeading icon={<TagIcon />} className="mb-2">
                  Review
                </DataPanel.SectionHeading>
                {(result.status || tags.length > 0) && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {result.status && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          result.status === 'needs-review'
                            ? 'bg-orange-500/10 text-orange-400'
                            : result.status === 'complete'
                              ? 'bg-accent1/10 text-accent1'
                              : 'bg-neutral3/10 text-neutral4'
                        }`}
                      >
                        {result.status}
                      </span>
                    )}
                    {tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-surface4 text-neutral4">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {canFlag && (
                  <div>
                    <Button size="sm" onClick={() => onFlagForReview!(result.id)}>
                      <ClipboardCheck />
                      Flag for Review
                    </Button>
                  </div>
                )}
                {result.status === 'needs-review' && onOpenInReview && (
                  <div>
                    <Button size="sm" onClick={onOpenInReview}>
                      <ExternalLinkIcon />
                      Review
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <DataPanel.CodeSection title="Input" icon={<FileCodeIcon />} codeStr={inputStr} />
            {showOriginalComparison && originalResult ? (
              <div className="grid gap-2">
                <p className="text-ui-sm text-neutral3">
                  Same item, same recorded world — any difference below comes from the agent change.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <DataPanel.CodeSection
                    title="Output — original run"
                    icon={<FileOutputIcon />}
                    codeStr={formatValue(stripToolReplayFromOutput(originalResult.output))}
                  />
                  <DataPanel.CodeSection title="Output — this replay" icon={<FileOutputIcon />} codeStr={outputStr} />
                </div>
              </div>
            ) : (
              <DataPanel.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />
            )}
            <DataPanel.CodeSection title="Ground Truth" icon={<TargetIcon />} codeStr={groundTruthStr} />
          </div>
        </DataPanel.Content>
      )}
    </DataPanel>
  );
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
