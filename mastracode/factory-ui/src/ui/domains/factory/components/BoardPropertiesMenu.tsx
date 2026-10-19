import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpDown, Funnel, LayersPlus } from 'lucide-react';

import { PropertiesMenu } from '../../../ui/PropertiesMenu';
import { boardFilterItems, boardFiltersActive, boardFilterValues, withBoardFilterValues } from '../boardFilters';
import { boardSortOptions, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardKind } from '../boardStages';
import type { BoardView } from '../hooks/useBoardView';
import { BoardFilterSubmenu } from './BoardFilterSubmenu';
import type { BoardFilterField } from './boardFilterFields';

export function BoardPropertiesMenu({
  kind,
  view,
  fields,
  currentUserId,
}: {
  kind: BoardKind;
  view: BoardView;
  fields: readonly BoardFilterField[];
  currentUserId?: string;
}) {
  const items = boardFilterItems(view.filters, kind);
  const changedCount = items.length + (view.sort === DEFAULT_BOARD_SORT ? 0 : 1);
  const canSaveAsView = !view.savedViews.applied && boardFiltersActive(view.filters, kind);

  return (
    <PropertiesMenu
      label="Board properties"
      variant="default"
      icon={<Funnel size={15} aria-hidden />}
      changedCount={changedCount}
      onReset={view.resetProperties}
    >
      <DropdownMenu.RadioSub
        label="Sort"
        icon={<ArrowUpDown aria-hidden />}
        options={boardSortOptions(currentUserId)}
        value={view.sort}
        onValueChange={view.setSort}
      />
      {fields
        .filter(field => !field.hidden)
        .map(field => (
          <BoardFilterSubmenu
            key={field.id}
            field={field}
            selected={boardFilterValues(view.filters, kind, field.id)}
            narrowing={items.some(item => item.fieldId === field.id)}
            onChange={values => view.setFilters(withBoardFilterValues(view.filters, kind, field.id, values))}
          />
        ))}
      {canSaveAsView && (
        <>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={() => view.savedViews.create(view.newViewSettings, items)}>
            <LayersPlus aria-hidden />
            <span>Save as view</span>
          </DropdownMenu.Item>
        </>
      )}
    </PropertiesMenu>
  );
}
