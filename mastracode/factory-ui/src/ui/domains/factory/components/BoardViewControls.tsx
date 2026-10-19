import { SavedViewEditor, SavedViewTabs } from '@mastra/playground-ui/components/SavedViews';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Kanban, List } from 'lucide-react';
import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import type { BoardParticipant } from '../boardRelevance';
import type { BoardViewSettings } from '../boardSavedViews';
import { BOARD_SORT_LABELS } from '../boardSort';
import type { BoardKind } from '../boardStages';
import { useBoardFilterSources } from '../hooks/useBoardFilterSources';
import type { BoardView } from '../hooks/useBoardView';
import { BOARD_FILTER_OPERATORS, boardFilterFields } from './boardFilterFields';
import { BoardPropertiesMenu } from './BoardPropertiesMenu';
import { BoardViewControlsLayout } from './BoardViewControlsLayout';

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
  const { connectedSources, linearProjects } = useBoardFilterSources();
  const fields = boardFilterFields({
    kind,
    participants,
    availableLabels,
    connectedSources,
    selectedSources: view.filters.sources,
    linearProjects,
    currentUserId,
    teammateSelected: view.filters.participantIds.size > 0,
  });

  return (
    <BoardViewControlsLayout
      views={
        <>
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
            <SegmentedControl aria-label="Layout" size="sm" iconOnly value={view.layout} onValueChange={view.setLayout}>
              <SegmentedControlItem value="list" aria-label={LAYOUT_LABELS.list} title={LAYOUT_LABELS.list}>
                <List aria-hidden />
              </SegmentedControlItem>
              <SegmentedControlItem value="board" aria-label={LAYOUT_LABELS.board} title={LAYOUT_LABELS.board}>
                <Kanban aria-hidden />
              </SegmentedControlItem>
            </SegmentedControl>
            <BoardPropertiesMenu kind={kind} view={view} fields={fields} currentUserId={currentUserId} />
          </div>
        </>
      }
      search={
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
      }
      aside={aside}
      editor={savedViews.draft && <SavedViewEditor views={savedViews} />}
    />
  );
}
