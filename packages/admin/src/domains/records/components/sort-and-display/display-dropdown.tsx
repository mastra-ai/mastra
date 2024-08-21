import { Property } from '@arkw/core';
import { ReactNode } from 'react';

import { Dropdown } from '@/components/ui/dropdown-menu';

import { SortLogic } from '../../types';

import DisplayDropdownFields from './display-dropdown-properties';

interface DisplayDropdown {
  children: ReactNode;

  sortLogic?: SortLogic;
  setSortLogic?: (sortLogic: SortLogic | null) => void;
  properties: Property[];
  setPropertiesData?: (propertiesData: { properties: Property[] }) => void;
}

const DisplayDropdown = ({ children, properties, setPropertiesData, setSortLogic, sortLogic }: DisplayDropdown) => {
  if (!setPropertiesData) return null;

  return (
    <Dropdown modal={false}>
      <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
      <Dropdown.Content className="w-[275px] text-xs" align="start">
        <div className="space-y-[10px] px-[18px] py-3">
          {/* <DisplayDropdownSort properties={properties} sortLogic={sortLogic || null} setSortLogic={setSortLogic} /> */}
        </div>
        <Dropdown.Separator />
        <div className="space-y-[10px] px-[18px] py-3">
          <DisplayDropdownFields properties={properties} setPropertiesData={setPropertiesData!} />
        </div>
      </Dropdown.Content>
    </Dropdown>
  );
};

export default DisplayDropdown;
