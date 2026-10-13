import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ReviewStatusBadge } from '@mastra/playground-ui/domains/review/components/review-status-badge';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { GaugeIcon } from 'lucide-react';
import { useState } from 'react';
import { getResultErrorMessage, getResultOutputPreview } from '../utils/result-output';
import { formatCostValue, formatTokenCount, totalTokens } from './comparison/comparison-metric-format';
import { ComputedTag } from '@/domains/observability/components/computed-tag';

/**
 * Minimal shape shared by every surface that lists dataset items
 * (experiment results, review queue). `DatasetExperimentResult`
 * and the review `ReviewItem` both satisfy it.
 */
export type ExperimentResultsListItem = {
  id: string;
  itemId: string;
  input?: unknown;
  output?: unknown;
  targetType?: DatasetExperimentResult['targetType'];
  error?: unknown;
  status?: DatasetExperimentResult['status'] | null;
  tags?: string[] | null;
  /** Inline scores, used by the summary `scores` column. */
  scores?: Record<string, number> | Array<{ score: number | null }> | null;
  /** When the run started; drives the `startedAt` column. */
  startedAt?: string | Date | null;
  /** When the run finished; with `startedAt`, drives the `duration` column. */
  completedAt?: string | Date | null;
  /** Token usage and cost of the run's trace; drives the `cost` and `tokens` columns. */
  usage?: { inputTokens?: number; outputTokens?: number; estimatedCost?: number; costUnit?: string };
};

const BUILT_IN_COLUMNS = new Set([
  'itemId',
  'id',
  'status',
  'input',
  'output',
  'error',
  'tags',
  'scores',
  'startedAt',
  'cost',
  'tokens',
  'duration',
]);

export type ExperimentResultsSortKey = 'startedAt';

export type ExperimentResultsListColumn = {
  /** `itemId` (or `id`) | `status` | `input` | `tags` | `scores` | `startedAt` | `cost` | `tokens` | `duration` | a scorer id */
  name: string;
  label: string;
  size: string;
};

export type ExperimentResultsListProps<T extends ExperimentResultsListItem> = {
  results: T[];
  isLoading: boolean;
  featuredResultId: string | null;
  onResultClick: (resultId: string) => void;
  columns: ExperimentResultsListColumn[];
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  scorerIds?: string[];
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  emptyMessage?: string;
  selectedIds?: Set<string>;
  onToggleSelect?: (resultId: string) => void;
  /** When provided with selection, renders a select-all checkbox in the header. */
  onToggleSelectAll?: () => void;
  /** Server-side sort; the `startedAt` header is only sortable when `onSortChange` is provided. */
  sort?: ListSort<ExperimentResultsSortKey>;
  onSortChange?: (direction: 'asc' | 'desc', key: ExperimentResultsSortKey) => void;
  /** Arrow/page/Home/End keyboard navigation also opens the result it lands on. */
  selectOnNavigate?: boolean;
  /** Listen for ArrowUp/ArrowDown on the whole page, before any row has focus. */
  keyboardGlobal?: boolean;
};

/**
 * List component for experiment results - controlled by parent for selection state.
 */
export function ExperimentResultsList<T extends ExperimentResultsListItem>({
  results,
  isLoading,
  featuredResultId,
  onResultClick,
  columns: requestedColumns,
  scoresByItemId,
  scorerIds,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  emptyMessage = 'No results yet',
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  sort,
  onSortChange,
  selectOnNavigate = false,
  keyboardGlobal = false,
}: ExperimentResultsListProps<T>) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const hasSelection = Boolean(selectedIds && onToggleSelect);
  // Only columns the body knows how to render get a track + header; otherwise
  // an unknown name would shift every following cell away from its header.
  const columns = requestedColumns.filter(c => BUILT_IN_COLUMNS.has(c.name) || scorerIds?.includes(c.name));
  const gridColumns = [hasSelection ? '2rem' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');
  const hasColumn = (name: string) => columns.some(col => col.name === name);
  const hasItemIdColumn = hasColumn('itemId') || hasColumn('id');
  const hasStatusColumn = hasColumn('status');
  const hasInputColumn = hasColumn('input');
  const hasOutputColumn = hasColumn('output');
  const hasErrorColumn = hasColumn('error');
  const hasTagsColumn = hasColumn('tags');
  const hasScoresColumn = hasColumn('scores');
  const hasStartedAtColumn = hasColumn('startedAt');
  const hasCostColumn = hasColumn('cost');
  const hasTokensColumn = hasColumn('tokens');
  const hasDurationColumn = hasColumn('duration');
  const selectedVisibleCount = selectedIds ? results.filter(r => selectedIds.has(r.id)).length : 0;
  const isAllSelected = results.length > 0 && selectedVisibleCount === results.length;

  const { containerRef, getRowProps, setActiveIndex } = useDataListKeyboard({
    count: results.length,
    global: keyboardGlobal,
    // Skip the clamped boundary case: re-clicking the open result would close it.
    onNavigate: selectOnNavigate
      ? index => {
          const result = results[index];
          if (result && result.id !== featuredResultId) onResultClick(result.id);
        }
      : undefined,
  });

  // Keep the roving index on the open result when it changes from outside the
  // list (prev/next buttons, panel shortcuts), so the next arrow press continues from it.
  const featuredIndex = results.findIndex(r => r.id === featuredResultId);
  const [syncedFeaturedIndex, setSyncedFeaturedIndex] = useState(featuredIndex);
  if (featuredIndex !== syncedFeaturedIndex) {
    setSyncedFeaturedIndex(featuredIndex);
    if (featuredIndex >= 0) setActiveIndex(featuredIndex);
  }

  // Scorer columns get the scorers icon (matching the sidebar nav) plus a
  // link to the scorer page, so score columns are recognizable even
  // when the scorer name isn't self-explanatory.
  const renderTopCell = (col: { name: string; label: string }) =>
    scorerIds?.includes(col.name) ? (
      <DataList.TopCell key={col.name}>
        <LinkComponent
          href={paths.scorerLink(col.name)}
          className="flex min-w-0 items-center gap-1.5 hover:underline [&>svg]:size-3.5 [&>svg]:shrink-0"
        >
          <ScorersIcon />
          <span className="min-w-0 truncate">{col.label}</span>
        </LinkComponent>
      </DataList.TopCell>
    ) : col.name === 'startedAt' && onSortChange ? (
      <DataList.SortableTopCell
        key={col.name}
        sortKey="startedAt"
        sort={sort?.key === 'startedAt' ? sort.direction : undefined}
        onSortChange={onSortChange}
      >
        {col.label}
      </DataList.SortableTopCell>
    ) : (
      <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>
    );

  if (isLoading) {
    return <DataListSkeleton columns={gridColumns} />;
  }

  return (
    <DataList columns={gridColumns} className="min-w-0" scrollRef={containerRef} fit="container">
      <DataList.Top hasLeadingCell={hasSelection}>
        {hasSelection &&
          (onToggleSelectAll ? (
            <DataList.TopSelectCell
              checked={isAllSelected ? true : selectedVisibleCount > 0 ? 'indeterminate' : false}
              onToggle={onToggleSelectAll}
              aria-label="Select all"
            />
          ) : (
            <DataList.TopCell>&nbsp;</DataList.TopCell>
          ))}
        {hasSelection ? (
          <DataList.TopCells colStart={2}>{columns.map(renderTopCell)}</DataList.TopCells>
        ) : (
          columns.map(renderTopCell)
        )}
      </DataList.Top>

      {results.length === 0 ? (
        <DataList.NoMatch message={emptyMessage} />
      ) : (
        <>
          {results.map((result, index) => {
            const hasError = Boolean(result.error);
            const isFeatured = result.id === featuredResultId;

            const rowCells = (
              <>
                {hasItemIdColumn && (
                  <DataList.Cell className="text-muted-foreground">{result.itemId?.slice(0, 8) ?? ''}</DataList.Cell>
                )}

                {hasStatusColumn && (
                  <DataList.Cell className="flex items-center" data-testid={`result-status-${result.id}`}>
                    {result.status ? (
                      <ReviewStatusBadge status={result.status} />
                    ) : (
                      <span className="text-placeholder">—</span>
                    )}
                  </DataList.Cell>
                )}

                {hasInputColumn && (
                  <DataList.TextCell font="mono">{truncate(formatValue(result.input), 200)}</DataList.TextCell>
                )}

                {hasOutputColumn && (
                  <DataList.Cell className="truncate font-mono" data-testid={`result-output-${result.id}`}>
                    {getResultOutputPreview(result) ?? ''}
                  </DataList.Cell>
                )}

                {hasErrorColumn && (
                  <DataList.Cell
                    className="truncate text-destructive-foreground"
                    data-testid={`result-error-${result.id}`}
                  >
                    {getResultErrorMessage(result) ?? ''}
                  </DataList.Cell>
                )}

                {hasTagsColumn && (
                  <DataList.Cell
                    className="flex items-center gap-1 overflow-hidden"
                    data-testid={`result-tags-${result.id}`}
                  >
                    {result.tags?.map(tag => (
                      <ComputedTag key={tag} value={tag} className="shrink-0" />
                    ))}
                  </DataList.Cell>
                )}

                {hasScoresColumn && (
                  <DataList.Cell>
                    <ScoresSummary scores={result.scores} />
                  </DataList.Cell>
                )}

                {hasStartedAtColumn &&
                  (result.startedAt ? (
                    <DataList.TextCell data-testid={`result-created-${result.id}`}>
                      {formatDate(result.startedAt, 'date-time')}
                    </DataList.TextCell>
                  ) : (
                    <DataList.Cell className="text-placeholder">—</DataList.Cell>
                  ))}

                {hasCostColumn && (
                  <DataList.Cell
                    className="text-muted-foreground tabular-nums"
                    data-testid={`result-cost-${result.id}`}
                  >
                    {formatCostValue(result.usage?.estimatedCost, result.usage?.costUnit)}
                  </DataList.Cell>
                )}

                {hasTokensColumn && (
                  <DataList.Cell
                    className="text-muted-foreground tabular-nums"
                    data-testid={`result-tokens-${result.id}`}
                  >
                    {formatTokenCount(totalTokens(result.usage))}
                  </DataList.Cell>
                )}

                {hasDurationColumn && (
                  <DataList.Cell
                    className="text-muted-foreground tabular-nums"
                    data-testid={`result-duration-${result.id}`}
                  >
                    {formatDuration(runDurationMs(result)) ?? '-'}
                  </DataList.Cell>
                )}

                {scorerIds?.map(scorerId => {
                  const scores = scoresByItemId?.[result.itemId];
                  const score = scores?.find(s => s.scorerId === scorerId);
                  return (
                    <DataList.Cell key={scorerId} className="text-muted-foreground tabular-nums">
                      {score != null ? score.score.toFixed(3) : '-'}
                    </DataList.Cell>
                  );
                })}
              </>
            );

            if (!hasSelection) {
              return (
                <DataList.RowButton
                  key={result.id}
                  featured={isFeatured}
                  variant={hasError ? 'error' : 'default'}
                  data-selected={isFeatured || undefined}
                  onClick={() => onResultClick(result.id)}
                  {...getRowProps(index)}
                >
                  {rowCells}
                </DataList.RowButton>
              );
            }

            return (
              <DataList.RowWrapper key={result.id}>
                <DataList.SelectCell
                  checked={selectedIds!.has(result.id)}
                  onToggle={() => onToggleSelect!(result.id)}
                  aria-label={`Select result ${result.itemId}`}
                />
                <DataList.RowButton
                  colStart={2}
                  featured={isFeatured}
                  variant={hasError ? 'error' : 'default'}
                  data-selected={isFeatured || undefined}
                  onClick={() => onResultClick(result.id)}
                  {...getRowProps(index)}
                >
                  {rowCells}
                </DataList.RowButton>
              </DataList.RowWrapper>
            );
          })}

          <DataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </DataList>
  );
}

function ScoresSummary({ scores }: { scores: ExperimentResultsListItem['scores'] }) {
  const values = Array.isArray(scores)
    ? scores.map(s => s.score).filter((v): v is number => v != null)
    : Object.values(scores ?? {});
  if (values.length === 0) {
    return (
      <Txt variant="meta" tone="faint">
        —
      </Txt>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Icon size="xs" className="text-muted-foreground">
        <GaugeIcon />
      </Icon>
      <Txt variant="meta" tone="muted" font="mono">
        {values[0].toFixed(2)}
      </Txt>
      {values.length > 1 && <Badge>+{values.length - 1}</Badge>}
    </div>
  );
}

function runDurationMs({ startedAt, completedAt }: ExperimentResultsListItem): number | undefined {
  if (!startedAt || !completedAt) return undefined;
  return new Date(completedAt).getTime() - new Date(startedAt).getTime();
}

/** Format unknown value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/** Truncate string to max length */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '...';
}
