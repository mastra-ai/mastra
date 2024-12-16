import { PropertyType } from '@mastra/core';
import React, { useMemo } from 'react';

// import Image from 'next/image';
import { Icon } from '@/components/icon';
import { Dropdown } from '@/components/ui/dropdown-menu';

// import manualSort from '@/icons/manual-sort.svg';
import { cn } from '@/lib/utils';

import { SortField, SortLogic } from '../../types';
import { sortablePropertyTypeSet } from '../../utils';
import { propertyTypeToIconMap } from '../columns/column-def';

interface SortDropDownProps {
  children: React.ReactNode;
  properties: SortField[];
  sortLogic: SortLogic | null;
  setSortLogic?: (sortLogic: SortLogic | null) => void;
}

const SortDropdown = React.forwardRef<HTMLSpanElement, SortDropDownProps>(
  ({ children, sortLogic, setSortLogic, properties }, ref) => {
    const sortFields = useMemo(() => {
      return properties.filter(property => property.name !== 'stage' && sortablePropertyTypeSet.has(property.type));
    }, [properties]);

    const handleSortSelect = (sortField: SortField | null) => {
      setSortLogic?.(sortField ? { field: sortField, mode: 'ascending' } : null);
    };

    return (
      <Dropdown>
        <Dropdown.Trigger asChild>{children}</Dropdown.Trigger>
        <Dropdown.Content className="w-56">
          <Dropdown.Group title="Order">
            <span className="pl-[5px] text-xs opacity-50">Order</span>
            <Dropdown.Item
              onClick={() => handleSortSelect(null)}
              className={cn(!sortLogic ? 'bg-white bg-opacity-10' : 'cursor-pointer')}
            >
              {/* <Image alt="fields" src={manualSort} className="mr-2 h-4 w-4" /> */}
              <span>Manual</span>
            </Dropdown.Item>
            {sortFields.map(field => (
              <Dropdown.Item
                key={field.name}
                onClick={() => handleSortSelect(field)}
                className={cn(field.name === sortLogic?.field.name ? 'bg-white bg-opacity-10' : 'cursor-pointer')}
              >
                <Icon name={propertyTypeToIconMap[field.type as PropertyType]} />
                <span>{field.displayName}</span>
              </Dropdown.Item>
            ))}
          </Dropdown.Group>
        </Dropdown.Content>
      </Dropdown>
    );
  },
);
SortDropdown.displayName = 'SortDropdown';

export { SortDropdown };
