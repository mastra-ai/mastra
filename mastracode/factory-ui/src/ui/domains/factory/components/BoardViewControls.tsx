import { SavedViewEditor, SavedViewTabs } from '@mastra/playground-ui/components/SavedViews';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Kanban, List } from 'lucide-react';
import type { ReactNode } from 'react';

import { boardFilterItems, boardFiltersActive } from '../boardFilters';
import type { BoardLayout } from '../boardLayout';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardViewSettings } from '../boardSavedViews';
import type { BoardKind } from '../boardStages';
import type { BoardView } from '../hooks/useBoardView';
import { BOARD_FILTER_OPERATORS, BoardFilters, useBoardFilterFields } from './BoardFilters';
import { BOARD_SORT_LABELS, BoardSortControl } from './BoardSortControl';

const LAYOUT_LABELS: Record<BoardLayout, string> = { board: 'Board', list: 'List' };

function describeViewSettings(settings: BoardViewSettings) {
  return (
    <Txt as="span" variant="caption" tone="muted">
      {LAYOUT_LABELS[settings.layout]} · {BOARD_SORT_LABELS[settings.sort]}
    </Txt>
  );
}

/**
 * The sort and saved view tabs, with `aside` at the end of their row. Below them, the filters in
 * use: the board's own, or the open view's. Unsaved changes tint the row and bring their actions:
 * Save as view on the default view, Cancel and Save on a saved one.
 */
export function BoardViewControls({
  kind,
  view,
  participants,
  availableLabels,
  currentUserId,
  aside,
}: {
  kind: BoardKind;
  view: BoardView;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  aside?: ReactNode;
}) {
  const { savedViews } = view;
  const fields = useBoardFilterFields({
    kind,
    participants,
    availableLabels,
    currentUserId,
    teammateSelected: view.filters.participantIds.size > 0,
  });
  const filters = (
    <BoardFilters
      kind={kind}
      fields={fields}
      filters={view.filters}
      onFiltersChange={view.setFilters}
      aria-label={savedViews.applied ? 'View filters' : 'Board filters'}
    />
  );
  const filtersSlot = <div className="min-w-0 flex-1">{filters}</div>;
  const layoutToggle = (
    <SegmentedControl aria-label="Layout" size="sm" iconOnly value={view.layout} onValueChange={view.setLayout}>
      <SegmentedControlItem value="list" aria-label={LAYOUT_LABELS.list} title={LAYOUT_LABELS.list}>
        <List aria-hidden />
      </SegmentedControlItem>
      <SegmentedControlItem value="board" aria-label={LAYOUT_LABELS.board} title={LAYOUT_LABELS.board}>
        <Kanban aria-hidden />
      </SegmentedControlItem>
    </SegmentedControl>
  );
  const saveAsView = () => savedViews.create(view.newViewSettings, boardFilterItems(view.filters, kind));
  const pageFiltersActive = !savedViews.applied && boardFiltersActive(view.filters, kind);
  const unsaved = Boolean(savedViews.draft) || pageFiltersActive;

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <BoardSortControl value={view.sort} currentUserId={currentUserId} onChange={view.setSort} />
          <SavedViewTabs
            aria-label="Board views"
            views={savedViews}
            fields={fields}
            operators={BOARD_FILTER_OPERATORS}
            defaultLabel="All cards"
            newViewSettings={view.newViewSettings}
            describeSettings={describeViewSettings}
          />
        </div>
        {aside && <div className="ml-auto shrink-0">{aside}</div>}
      </div>
      <div
        role="group"
        aria-label="Board view controls"
        className={cn(
          'mt-3 -mx-1.5 flex min-h-10 min-w-0 flex-wrap items-center gap-2 rounded-xl p-1.5 transition-colors duration-200 motion-reduce:transition-none',
          unsaved && 'bg-fill-subtle',
        )}
      >
        {savedViews.draft ? (
          <SavedViewEditor views={savedViews} className="flex-1">
            {filtersSlot}
            {layoutToggle}
          </SavedViewEditor>
        ) : (
          filtersSlot
        )}
        {pageFiltersActive && (
          <Button type="button" variant="ghost" size="sm" onClick={saveAsView}>
            Save as view
          </Button>
        )}
      </div>
    </div>
  );
}
