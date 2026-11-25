import { boardFilterSummary } from './board-filter-fields';
import type { BoardFilterField } from './board-filter-fields';
import { BoardFilterSubmenu } from './board-filter-submenu';
import { boardFilterValuesActive } from './board-view-state';

import type { BoardSortOption, BoardViewState } from './board-view-state';
import { PropertiesMenu } from './properties-menu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowsUpDown } from '@/ds/icons/central/IconArrowsUpDown';
import { IconFilter1 } from '@/ds/icons/central/IconFilter1';
import { IconLayersThree } from '@/ds/icons/central/IconLayersThree';

export interface BoardPropertiesMenuProps<Sort extends string, FieldId extends string = string> {
  view: BoardViewState<Sort>;
  fields: readonly BoardFilterField<FieldId>[];
  sortOptions: readonly BoardSortOption<Sort>[];
  sortLabels: Readonly<Record<Sort, string>>;
  defaultSort: Sort;
  /** The host applies field rules (e.g. clearing a dependent filter) when one field's values change. */
  onFilterChange: (fieldId: FieldId, values: string[]) => void;
}

export function BoardPropertiesMenu<Sort extends string, FieldId extends string = string>({
  view,
  fields,
  sortOptions,
  sortLabels,
  defaultSort,
  onFilterChange,
}: BoardPropertiesMenuProps<Sort, FieldId>) {
  const selected = (fieldId: string) => [...(view.filters[fieldId] ?? [])];
  const changes = [
    ...(view.sort === defaultSort ? [] : [`Sort: ${sortLabels[view.sort]}`]),
    ...fields
      .filter(field => selected(field.id).length > 0)
      .map(field => `${field.label}: ${boardFilterSummary(field, selected(field.id))}`),
  ];
  const canSaveAsView = !view.savedViews.applied && boardFilterValuesActive(view.filters);

  return (
    <PropertiesMenu
      label="Board properties"
      variant="default"
      icon={<IconFilter1 aria-hidden />}
      changedCount={changes.length}
      changes={changes}
      onReset={view.resetProperties}
    >
      <DropdownMenu.RadioSub
        label="Sort"
        icon={<IconArrowsUpDown aria-hidden />}
        options={[...sortOptions]}
        value={view.sort}
        onValueChange={value => view.setSort(value)}
      />
      {fields
        .filter(field => !field.hidden)
        .map(field => (
          <BoardFilterSubmenu
            key={field.id}
            field={field}
            selected={selected(field.id)}
            onChange={values => onFilterChange(field.id, values)}
          />
        ))}
      {canSaveAsView && (
        <>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={view.saveAsView}>
            <IconLayersThree aria-hidden />
            <span>Save as view</span>
          </DropdownMenu.Item>
        </>
      )}
    </PropertiesMenu>
  );
}
