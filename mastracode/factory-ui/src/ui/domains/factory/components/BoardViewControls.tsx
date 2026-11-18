import { Button } from '@mastra/playground-ui/components/Button';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { SavedViewEditor, SavedViewTabs } from '@mastra/playground-ui/components/SavedViews';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import type { BoardParticipant } from '../boardPeople';
import type { BoardViewSettings } from '../boardSavedViews';
import { BOARD_SORT_LABELS } from '../boardSort';
import { useBoardFilterSources } from '../hooks/useBoardFilterSources';
import type { BoardView } from '../hooks/useBoardView';
import { BOARD_FILTER_OPERATORS, boardFilterFields } from './boardFilterFields';
import { BoardPropertiesMenu } from './BoardPropertiesMenu';
import { BoardViewControlsLayout } from './BoardViewControlsLayout';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconLayersThree } from '@mastra/playground-ui/icons/central/IconLayersThree';
import { IconListBullets } from '@mastra/playground-ui/icons/central/IconListBullets';

const LAYOUT_LABELS: Record<BoardLayout, string> = { board: 'Board', list: 'List' };
const DEFAULT_VIEW_LABEL = 'All cards';
const VIEWS_LABEL = 'Board views';

function ViewSettingsSummary({ settings }: { settings: BoardViewSettings }) {
  return (
    <Txt as="span" variant="caption" tone="muted">
      <Metadata>
        <Metadata.Item>{LAYOUT_LABELS[settings.layout]}</Metadata.Item>
        <Metadata.Item>{BOARD_SORT_LABELS[settings.sort]}</Metadata.Item>
      </Metadata>
    </Txt>
  );
}

export function BoardDefaultViewTabs({ selected }: { selected: boolean }) {
  return (
    <div role="group" aria-label={VIEWS_LABEL} className="flex flex-wrap items-center gap-1.5">
      <Button variant={selected ? 'subtle' : 'default'} size="sm" aria-pressed={selected}>
        {DEFAULT_VIEW_LABEL}
      </Button>
      <Button size="icon-sm" tooltip="New view">
        <IconLayersThree />
      </Button>
    </div>
  );
}

export function BoardLayoutToggle({
  value,
  onValueChange,
}: {
  value: BoardLayout;
  onValueChange?: (next: BoardLayout) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Layout"
      size="sm"
      iconOnly
      value={value}
      onValueChange={next => onValueChange?.(next)}
    >
      <SegmentedControlItem value="list" aria-label={LAYOUT_LABELS.list} title={LAYOUT_LABELS.list}>
        <IconListBullets aria-hidden />
      </SegmentedControlItem>
      <SegmentedControlItem value="board" aria-label={LAYOUT_LABELS.board} title={LAYOUT_LABELS.board}>
        <IconKanbanView aria-hidden />
      </SegmentedControlItem>
    </SegmentedControl>
  );
}

export function BoardSearchInput({
  value,
  inView,
  onValueChange,
}: {
  value: string;
  inView: boolean;
  onValueChange?: (next: string) => void;
}) {
  return (
    <SearchInput
      label="Search cards"
      placeholder={inView ? 'Search this view' : 'Search cards'}
      value={value}
      onValueChange={next => onValueChange?.(next)}
      size="sm"
      className="w-48 max-w-full max-sm:min-w-0 max-sm:flex-1"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onValueChange?.('');
        }
      }}
    />
  );
}

export function BoardViewControls({
  reviewsPullRequests,
  view,
  participants,
  availableLabels,
  currentUserId,
  aside,
}: {
  reviewsPullRequests: boolean;
  view: BoardView;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  aside: ReactNode;
}) {
  const { savedViews } = view;
  const { connectedSources, linearProjects } = useBoardFilterSources();
  const fields = boardFilterFields({
    reviewsPullRequests,
    filters: view.filters,
    participants,
    availableLabels,
    connectedSources,
    linearProjects,
    currentUserId,
  });

  return (
    <BoardViewControlsLayout
      tabs={
        <SavedViewTabs
          aria-label={VIEWS_LABEL}
          views={savedViews}
          fields={fields}
          operators={BOARD_FILTER_OPERATORS}
          defaultLabel={DEFAULT_VIEW_LABEL}
          newViewSettings={view.newViewSettings}
          describeSettings={settings => <ViewSettingsSummary settings={settings} />}
        />
      }
      layoutToggle={<BoardLayoutToggle value={view.layout} onValueChange={view.setLayout} />}
      properties={<BoardPropertiesMenu view={view} fields={fields} currentUserId={currentUserId} />}
      search={
        <BoardSearchInput
          value={view.search}
          inView={savedViews.applied !== undefined}
          onValueChange={view.setSearch}
        />
      }
      aside={aside}
      editor={savedViews.draft && <SavedViewEditor views={savedViews} />}
    />
  );
}
