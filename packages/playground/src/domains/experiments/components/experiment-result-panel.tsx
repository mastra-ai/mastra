'use client';

import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { format } from 'date-fns/format';
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ClipboardCheck,
  ExternalLinkIcon,
  FileCodeIcon,
  FileOutputIcon,
  TagIcon,
  TargetIcon,
} from 'lucide-react';
import { useState } from 'react';
import { ToolMockReportSection } from './tool-mock-report-section';

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
}: ExperimentResultPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const hasError = Boolean(result?.error);
  const inputStr = formatValue(result?.input);
  const outputStr = formatValue(result?.output);
  const groundTruthStr = formatValue(result?.groundTruth);
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
                    <DataList.Cell height="compact">{score.scorerId}</DataList.Cell>
                    <DataList.MonoCell>{score.score.toFixed(3)}</DataList.MonoCell>
                  </DataList.RowButton>
                ))}
              </DataList>
            )}

            {result.toolMockReport && <ToolMockReportSection report={result.toolMockReport} />}

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
            <DataPanel.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={outputStr} />
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
