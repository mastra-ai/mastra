import type { ReactNode } from 'react';

import { BOARD_FILTER_OPERATORS } from './board-filter-fields';
import type { BoardLayout } from './board-layout';
import { BoardPropertiesMenu } from './board-properties-menu';
import type { BoardPropertiesMenuProps } from './board-properties-menu';
import { BoardViewControlsLayout } from './board-view-controls-layout';
import { Metadata } from '@/ds/components/Metadata';
import { SavedViewEditor, SavedViewTabs } from '@/ds/components/SavedViews';

import { SearchInput } from '@/ds/components/SearchInput';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Txt } from '@/ds/components/Txt';
import { IconKanbanView } from '@/ds/icons/central/IconKanbanView';
import { IconListBullets } from '@/ds/icons/central/IconListBullets';

const LAYOUT_LABELS: Record<BoardLayout, string> = { board: 'Board', list: 'List' };

export interface BoardViewControlsProps<
  Sort extends string,
  FieldId extends string = string,
> extends BoardPropertiesMenuProps<Sort, FieldId> {
  aside?: ReactNode;
}

export function BoardViewControls<Sort extends string, FieldId extends string = string>({
  aside,
  ...menu
}: BoardViewControlsProps<Sort, FieldId>) {
  const { view, fields, sortLabels } = menu;
  const { savedViews } = view;

  return (
    <BoardViewControlsLayout
      views={
        <>
          <SavedViewTabs
            aria-label="Board views"
            className="max-sm:w-full"
            views={savedViews}
            fields={[...fields]}
            operators={BOARD_FILTER_OPERATORS}
            defaultLabel="All cards"
            newViewSettings={view.newViewSettings}
            describeSettings={settings => (
              <Txt as="span" variant="caption" tone="muted">
                <Metadata>
                  <Metadata.Item>{LAYOUT_LABELS[settings.layout]}</Metadata.Item>
                  <Metadata.Item>{sortLabels[settings.sort]}</Metadata.Item>
                </Metadata>
              </Txt>
            )}
          />
          <div className="flex shrink-0 items-center gap-2">
            <SegmentedControl
              aria-label="Layout"
              size="sm"
              iconOnly
              value={view.layout}
              onValueChange={value => view.setLayout(value)}
            >
              <SegmentedControlItem value="list" aria-label={LAYOUT_LABELS.list} title={LAYOUT_LABELS.list}>
                <IconListBullets aria-hidden />
              </SegmentedControlItem>
              <SegmentedControlItem value="board" aria-label={LAYOUT_LABELS.board} title={LAYOUT_LABELS.board}>
                <IconKanbanView aria-hidden />
              </SegmentedControlItem>
            </SegmentedControl>
            <BoardPropertiesMenu {...menu} />
          </div>
        </>
      }
      search={
        <SearchInput
          label="Search cards"
          placeholder={savedViews.applied ? 'Search this view' : 'Search cards'}
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
