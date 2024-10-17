import { Icon } from '@/components/icon';
import { Dropdown } from '@/components/ui/dropdown-menu';
import IconButton from '@/components/ui/icon-button';

import { cn } from '@/lib/utils';

import { propertyTypeToIconMap } from '@/domains/records/components/columns/column-def';

import { SortField, SortLogic } from '../../types';

import { SortDropdown } from './sort-dropdown';

interface DisplayDropdownSortProps {
  properties: SortField[];
  sortLogic: SortLogic | null;
  setSortLogic: (sortLogic: SortLogic | null) => void;
}

const DisplayDropdownSort = ({ properties, sortLogic, setSortLogic }: DisplayDropdownSortProps) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-primary text-xs">Sorting</p>
        <SortDropdown properties={properties} sortLogic={sortLogic} setSortLogic={setSortLogic}>
          <IconButton
            icon="plus-icon"
            className="flex w-6 items-center justify-center rounded-r bg-transparent px-1.5 py-0"
            aria-label="Add sort"
            aria-expanded={true}
          />
        </SortDropdown>
      </div>
      {sortLogic ? (
        <AppliedSorts sortLogic={sortLogic} setSortLogic={setSortLogic} />
      ) : (
        <p className="text-text-dim text-xs">No sorting applied</p>
      )}
    </>
  );
};

const SortingFieldName = ({ entityTypeField }: { entityTypeField: SortField }) => {
  return (
    <div className="bg-lightGray-7 flex h-full flex-1 flex-nowrap items-center gap-2 rounded-l p-1 pl-[6px]">
      <Icon
        name={propertyTypeToIconMap[entityTypeField.type as keyof typeof propertyTypeToIconMap]}
        className="text-icon-dim"
      />
      <p className="whitespace-nowrap text-xs font-medium">{entityTypeField.displayName}</p>
    </div>
  );
};

const SortLogicModeText = (mode: SortLogic['mode']) => {
  switch (mode) {
    case 'ascending':
      return 'Asc.';

    case 'descending':
      return 'Desc.';

    default:
      return '';
  }
};

const SortingOperator = ({
  sortLogic,
  setSortLogic,
}: {
  sortLogic: SortLogic;
  setSortLogic: (sortLogic: SortLogic | null) => void;
}) => {
  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <button className="bg-lightGray-7 flex h-full w-[60px] flex-shrink-0 items-center rounded-none p-1 text-xs capitalize text-neutral-400">
          <Icon name="arrow-up" className={cn('mr-1', sortLogic.mode === 'descending' && 'rotate-180')} />
          {SortLogicModeText(sortLogic.mode)}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start" className="w-fit">
        <Dropdown.Label className="sr-only">Choose a sort direction</Dropdown.Label>
        <Dropdown.Item key="asc" onClick={() => setSortLogic({ ...sortLogic, mode: 'ascending' })}>
          <Icon name="sort-up" className="w-3 text-neutral-100" aria-hidden />
          <span className="text-sm font-medium">Ascending</span>
        </Dropdown.Item>
        <Dropdown.Item key="desc" onClick={() => setSortLogic({ ...sortLogic, mode: 'descending' })}>
          <Icon name="sort-down" className="w-3 text-neutral-100" aria-hidden />
          <span className="text-sm font-medium">Descending</span>
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  );
};

export const AppliedSorts = ({
  sortLogic,
  setSortLogic,
}: {
  sortLogic: SortLogic;
  setSortLogic: (sortLogic: SortLogic | null) => void;
}) => {
  const { field } = sortLogic;

  return (
    <div className="flex h-6 w-full items-center gap-[2px] shadow-md shadow-neutral-900/10">
      <SortingFieldName entityTypeField={field} />
      <SortingOperator sortLogic={sortLogic} setSortLogic={setSortLogic} />
      <IconButton
        icon="cancel"
        className="bg-lightGray-7 flex h-full w-6 items-center justify-center rounded-l-none rounded-r p-1.5"
        onClick={() => setSortLogic(null)}
        aria-label="Clear all sort"
        aria-expanded={true}
      />
    </div>
  );
};

export default DisplayDropdownSort;
