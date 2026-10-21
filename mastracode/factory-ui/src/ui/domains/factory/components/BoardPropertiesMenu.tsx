import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpDown, Funnel, LayersPlus } from 'lucide-react';

import { PropertiesMenu } from '../../../ui/PropertiesMenu';
import { boardFiltersActive, withBoardFilterValues } from '../boardFilters';
import { BOARD_SORT_LABELS, boardSortOptions, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardView } from '../hooks/useBoardView';
import { BoardFilterSubmenu } from './BoardFilterSubmenu';
import { boardFilterSummary } from './boardFilterFields';
import type { BoardFilterField } from './boardFilterFields';

export function BoardPropertiesMenu({
  view,
  fields,
  currentUserId,
}: {
  view: BoardView;
  fields: readonly BoardFilterField[];
  currentUserId?: string;
}) {
  const changes = [
    ...(view.sort === DEFAULT_BOARD_SORT ? [] : [`Sort: ${BOARD_SORT_LABELS[view.sort]}`]),
    ...fields
      .filter(field => view.filters[field.id].size > 0)
      .map(field => `${field.label}: ${boardFilterSummary(field, [...view.filters[field.id]])}`),
  ];
  const canSaveAsView = !view.savedViews.activeView && boardFiltersActive(view.filters);

  return (
    <PropertiesMenu
      label="Board properties"
      variant="default"
      icon={<Funnel size={15} aria-hidden />}
      changedCount={changes.length}
      changes={changes}
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
            selected={[...view.filters[field.id]]}
            onChange={values => view.setFilters(withBoardFilterValues(view.filters, field.id, values))}
          />
        ))}
      {canSaveAsView && (
        <>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={view.saveAsView}>
            <LayersPlus aria-hidden />
            <span>Save as view</span>
          </DropdownMenu.Item>
        </>
      )}
    </PropertiesMenu>
  );
}
