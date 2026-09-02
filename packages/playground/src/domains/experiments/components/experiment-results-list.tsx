import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { AlertCircleIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

export type ExperimentResultsListProps = {
  results: DatasetExperimentResult[];
  isLoading: boolean;
  featuredResultId: string | null;
  onResultClick: (resultId: string) => void;
  columns: { name: string; label: string; size: string }[];
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  scorerIds?: string[];
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (resultId: string) => void;
};

/**
 * List component for experiment results - controlled by parent for selection state.
 */
export function ExperimentResultsList({
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
  selectedIds,
  onToggleSelect,
}: ExperimentResultsListProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const hasSelection = Boolean(selectedIds && onToggleSelect);
  const gridColumns = [hasSelection ? 'auto' : '', ...columns.map(c => c.size)].filter(Boolean).join(' ');
  const hasInputColumn = columns.some(col => col.name === 'input');

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
    <DataList columns={gridColumns} className="min-w-0" scrollRef={containerRef}>
      <DataList.Top hasLeadingCell={hasSelection}>
        {hasSelection && <DataList.TopCell>&nbsp;</DataList.TopCell>}
        {hasSelection ? (
          <DataList.TopCells colStart={2}>{columns.map(renderTopCell)}</DataList.TopCells>
        ) : (
          columns.map(renderTopCell)
        )}
      </DataList.Top>

      {results.length === 0 ? (
        <DataList.NoMatch message="No results yet" />
      ) : (
        <>
          {results.map((result, index) => {
            const hasError = Boolean(result.error);
            const isFeatured = result.id === featuredResultId;

            const rowCells = (
              <>
                <DataList.Cell className="text-ui-smd text-neutral3 flex items-center gap-1.5 tracking-wide">
                  <span>{result.itemId?.slice(0, 8) ?? ''}</span>
                  {hasError && (
                    <Tooltip>
                      <TooltipTrigger
                        render={<AlertCircleIcon role="img" aria-label="Error" className="text-error size-3.5" />}
                      />
                      <TooltipContent>{result.error?.message || 'Error'}</TooltipContent>
                    </Tooltip>
                  )}
                </DataList.Cell>

                {hasInputColumn && (
                  <DataList.TextCell font="mono">{truncate(formatValue(result.input), 200)}</DataList.TextCell>
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
