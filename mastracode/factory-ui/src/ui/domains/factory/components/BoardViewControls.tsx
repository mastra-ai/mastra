import { SavedViewEditor, SavedViewTabs } from '@mastra/playground-ui/components/SavedViews';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Button } from '@mastra/playground-ui/components/Button';
import { Kanban, List, ListFilter } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { boardFilterItems, boardFiltersActive } from '../boardFilters';
import type { BoardLayout } from '../boardLayout';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardViewSettings } from '../boardSavedViews';
import type { BoardKind } from '../boardStages';
import type { BoardView } from '../hooks/useBoardView';
import { BOARD_FILTER_OPERATORS, BoardFilters, boardFilterFields } from './BoardFilters';
import { BOARD_SORT_LABELS, BoardSortControl } from './BoardSortControl';

const LAYOUT_LABELS: Record<BoardLayout, string> = { board: 'Board', list: 'List' };

function ViewSettingsSummary({ settings }: { settings: BoardViewSettings }) {
  return (
    <Txt as="span" variant="caption" tone="muted">
      {LAYOUT_LABELS[settings.layout]} · {BOARD_SORT_LABELS[settings.sort]}
    </Txt>
  );
}

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
  const [pageFiltersOpen, setPageFiltersOpen] = useState(false);
  const fields = boardFilterFields({
    kind,
    participants,
    availableLabels,
    currentUserId,
    teammateSelected: view.filters.participantIds.size > 0,
  });
  const saveAsView = () => savedViews.create(view.newViewSettings, boardFilterItems(view.filters, kind));
  const pageFiltersActive = !savedViews.applied && boardFiltersActive(view.filters, kind);
  const filterCount = boardFilterItems(view.filters, kind).length;
  const showFilters = Boolean(savedViews.draft) || (!savedViews.applied && pageFiltersOpen);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 grow basis-80 flex-wrap items-center gap-3 max-sm:contents">
          <SavedViewTabs
            aria-label="Board views"
            className="max-sm:w-full"
            views={savedViews}
            fields={fields}
            operators={BOARD_FILTER_OPERATORS}
            defaultLabel="All cards"
            newViewSettings={view.newViewSettings}
            describeSettings={settings => <ViewSettingsSummary settings={settings} />}
          />
          <div className="flex shrink-0 items-center gap-2">
            {!savedViews.applied && (
              <Button
                variant={pageFiltersOpen || pageFiltersActive ? 'primary' : 'default'}
                size={filterCount ? 'sm' : 'icon-sm'}
                aria-label="Filter cards"
                aria-expanded={pageFiltersOpen}
                tooltip={pageFiltersOpen ? 'Hide filters' : 'Show filters'}
                onClick={() => setPageFiltersOpen(open => !open)}
              >
                <ListFilter aria-hidden />
                {filterCount > 0 && filterCount}
              </Button>
            )}
            <BoardSortControl value={view.sort} currentUserId={currentUserId} onChange={view.setSort} />
            {savedViews.applied && (
              <SegmentedControl
                aria-label="Layout"
                size="sm"
                iconOnly
                value={view.layout}
                onValueChange={view.setLayout}
              >
                <SegmentedControlItem value="list" aria-label={LAYOUT_LABELS.list} title={LAYOUT_LABELS.list}>
                  <List aria-hidden />
                </SegmentedControlItem>
                <SegmentedControlItem value="board" aria-label={LAYOUT_LABELS.board} title={LAYOUT_LABELS.board}>
                  <Kanban aria-hidden />
                </SegmentedControlItem>
              </SegmentedControl>
            )}
          </div>
        </div>
        <SearchInput
          label="Search cards"
          placeholder={savedViews.applied ? 'Search this view…' : 'Search cards…'}
          value={view.search}
          onValueChange={view.setSearch}
          size="sm"
          className="w-48 max-w-full max-sm:min-w-0 max-sm:flex-1"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              view.setSearch('');
            }
          }}
        />
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {showFilters && (
        <div
          role="group"
          aria-label="Board view controls"
          className="flex min-h-8 min-w-0 flex-wrap items-center gap-2"
        >
          <SavedViewEditor views={savedViews} className="flex-1">
            <div className="max-w-full min-w-0">
              <BoardFilters
                kind={kind}
                fields={fields}
                filters={view.filters}
                onFiltersChange={view.setFilters}
                removable
                aria-label={savedViews.applied ? 'View filters' : 'Board filters'}
              />
            </div>
            {pageFiltersActive && (
              <Button type="button" variant="ghost" size="sm" onClick={saveAsView}>
                Save as view
              </Button>
            )}
          </SavedViewEditor>
        </div>
      )}
    </div>
  );
}
