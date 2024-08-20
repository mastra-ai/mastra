import { Property } from '@arkw/core';
import { ReactNode } from 'react';

import { Dropdown } from '@/components/ui/dropdown-menu';

import { SortLogic } from '../../types';

import DisplayDropdownFields from './display-dropdown-fields';

interface DisplayDropdown {
  children: ReactNode;
  properties: Property[];
  sortLogic?: SortLogic;
  setSortLogic?: (sortLogic: SortLogic | null) => void;
  setPropertiesData?: (propertiesData: { properties: Property[]; lastOrderedAt?: number }) => void;
}

const DisplayDropdown = ({ children, properties, setPropertiesData, setSortLogic, sortLogic }: DisplayDropdown) => {
  if (!setPropertiesData || !setSortLogic) return null;
  return (
    <Dropdown modal={false}>
      <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
      <Dropdown.Content className="w-[275px] text-xs" align="start">
        <div className="space-y-[10px] px-[18px] py-3">
          {/* <DisplayDropdownSort properties={properties} sortLogic={sortLogic || null} setSortLogic={setSortLogic} /> */}
        </div>
        <Dropdown.Separator />
        <div className="space-y-[10px] px-[18px] py-3">
          <DisplayDropdownFields properties={properties} setPropertiesData={setPropertiesData} />
        </div>
      </Dropdown.Content>
    </Dropdown>
  );
};

export default DisplayDropdown;
