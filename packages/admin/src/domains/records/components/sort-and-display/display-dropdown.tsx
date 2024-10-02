import { Property } from '@mastra/core';
import { ReactNode } from 'react';

import { Dropdown } from '@/components/ui/dropdown-menu';

import { SortLogic } from '../../types';

import DisplayDropdownFields from './display-dropdown-properties';

interface DisplayDropdown {
  children: ReactNode;

  sortLogic?: SortLogic;
  setSortLogic?: (sortLogic: SortLogic | null) => void;
  properties: Property[];
  setPropertiesData?: (propertiesData: { properties: Property[]; lastOrderedAt?: number }) => void;
}

const DisplayDropdown = ({ children, properties, setPropertiesData, setSortLogic, sortLogic }: DisplayDropdown) => {
  if (!setPropertiesData) return null;

  return (
    <Dropdown modal={false}>
      <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
      <Dropdown.Content className="w-[275px] text-xs" align="end">
        <div className="space-y-[10px]  p-3">
          <DisplayDropdownFields properties={properties} setPropertiesData={setPropertiesData!} />
        </div>
      </Dropdown.Content>
    </Dropdown>
  );
};

export default DisplayDropdown;
