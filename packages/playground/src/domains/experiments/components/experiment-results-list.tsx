import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { AlertCircleIcon, GaugeIcon } from 'lucide-react';
import { ComputedTag } from '@/domains/observability/components/computed-tag';
import { useLinkComponent } from '@/lib/framework';

/**
 * Minimal shape shared by every surface that lists dataset items
 * (experiment results, review queue, inbox). `DatasetExperimentResult`
 * and the review `ReviewItem` both satisfy it.
 */
export type ExperimentResultsListItem = {
  id: string;
  itemId: string;
  input?: unknown;
  error?: unknown;
  status?: DatasetExperimentResult['status'] | null;
  tags?: string[] | null;
  /** Inline scores, used by the summary `scores` column. */
  scores?: Record<string, number> | ClientScoreRowData[] | null;
};

export type ExperimentResultsListColumn = {
  /** `itemId` (or `id`) | `status` | `input` | `tags` | `scores` | a scorer id */
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
};

/**
 * List component for experiment results - controlled by parent for selection state.
 */
export function ExperimentResultsList<T extends ExperimentResultsListItem>({
  results,
  isLoading,
  featuredResultId,
  onResultClick,
  columns,
  scoresByItemId,
  scorerIds,
  setEndOfListElement,
  isFetchingNextPage,
  hasNextPage,
  emptyMessage = 'No results yet',
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ExperimentResultsListProps<T>) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const hasSelection = Boolean(selectedIds && onToggleSelect);
  const gridColumns = [hasSelection ? '2rem' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');
  const hasColumn = (name: string) => columns.some(col => col.name === name);
  const hasItemIdColumn = hasColumn('itemId') || hasColumn('id');
  const hasStatusColumn = hasColumn('status');
  const hasInputColumn = hasColumn('input');
  const hasTagsColumn = hasColumn('tags');
  const hasScoresColumn = hasColumn('scores');
  const selectedVisibleCount = selectedIds ? results.filter(r => selectedIds.has(r.id)).length : 0;
  const isAllSelected = results.length > 0 && selectedVisibleCount === results.length;

  const { containerRef, getRowProps } = useDataListKeyboard({ count: results.length });

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
                  <DataList.Cell className="text-ui-smd text-neutral3 flex items-center gap-1.5 tracking-wide">
                    <span>{result.itemId?.slice(0, 8) ?? ''}</span>
                    {hasError && (
                      <Tooltip>
                        <TooltipTrigger
                          render={<AlertCircleIcon role="img" aria-label="Error" className="text-error size-3.5" />}
                        />
                        <TooltipContent>{errorMessage(result.error)}</TooltipContent>
                      </Tooltip>
                    )}
                  </DataList.Cell>
                )}

                {hasStatusColumn && (
                  <DataList.Cell className="flex items-center" data-testid={`result-status-${result.id}`}>
                    {result.status ? (
                      <Badge size="xs" variant={statusBadgeVariant(result.status)}>
                        {result.status}
                      </Badge>
                    ) : (
                      <span className="text-neutral2">—</span>
                    )}
                  </DataList.Cell>
                )}

                {hasInputColumn && (
                  <DataList.TextCell font="mono">{truncate(formatValue(result.input), 200)}</DataList.TextCell>
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

                {scorerIds?.map(scorerId => {
                  const scores = scoresByItemId?.[result.itemId];
                  const score = scores?.find(s => s.scorerId === scorerId);
                  return (
                    <DataList.Cell key={scorerId} className="text-neutral3 text-ui-smd font-mono">
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
      <Txt variant="ui-xs" className="text-neutral2">
        —
      </Txt>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Icon size="sm" className="text-neutral3">
        <GaugeIcon />
      </Icon>
      <Txt variant="ui-xs" className="text-neutral4 font-mono">
        {values[0].toFixed(2)}
      </Txt>
      {values.length > 1 && <Badge>+{values.length - 1}</Badge>}
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message || 'Error';
  }
  return typeof error === 'string' && error ? error : 'Error';
}

function statusBadgeVariant(status: NonNullable<DatasetExperimentResult['status']>) {
  if (status === 'needs-review') return 'orange';
  if (status === 'complete') return 'green';
  return 'neutral';
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
