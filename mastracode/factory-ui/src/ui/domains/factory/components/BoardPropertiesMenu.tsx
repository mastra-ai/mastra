import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { ArrowUpDown, LayersPlus } from 'lucide-react';

import { PropertiesMenu } from '../../../ui/PropertiesMenu';
import { boardFilterItems, boardFiltersActive, boardFilterValues, withBoardFilterValues } from '../boardFilters';
import { boardSortOptions, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardKind } from '../boardStages';
import type { BoardView } from '../hooks/useBoardView';
import type { BoardFilterField } from './boardFilterFields';

function selectionHint(options: readonly FilterBarOption[], selected: readonly string[]): string | undefined {
  if (selected.length === 0) return undefined;
  if (selected.length > 1) return `${selected.length} selected`;
  const only = options.find(option => option.value === selected[0]);
  return only?.label ?? selected[0];
}

function BoardFilterSub({
  field,
  selected,
  onChange,
}: {
  field: BoardFilterField;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const offered = new Set(field.suggestions.map(option => option.value));
  const options = [
    ...field.suggestions,
    ...selected.filter(value => !offered.has(value)).map((value): FilterBarOption => ({ value })),
  ];
  if (options.length === 0) return null;
  const Icon = field.icon;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={selectionHint(options, selected)}>
        {Icon && <Icon aria-hidden />}
        <span>{field.label}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        {options.map(option => (
          <DropdownMenu.CheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={checked =>
              onChange(checked ? [...selected, option.value] : selected.filter(value => value !== option.value))
            }
          >
            {option.start}
            <span>{option.label ?? option.value}</span>
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

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
          <BoardFilterSub
            key={field.id}
            field={field}
            selected={boardFilterValues(items, field.id)}
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
