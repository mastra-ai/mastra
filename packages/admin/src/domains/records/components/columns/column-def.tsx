import { Property } from '@mastra/core';
import { CellContext } from '@tanstack/react-table';

import { IconName } from '@/types/icons';

import { CellComponent } from './cell-component';
import { HeaderCell } from './header-cell';

export const propertyTypeToIconMap: Record<string, IconName> = {
  SINGLE_LINE_TEXT: 'text',
};

export const createColumnDef = ({ properties }: { properties: Property[] }) => {
  console.log({ properties });
  const columnDef = properties
    .slice()
    .filter(property => property.visible)
    .sort((a, b) => a.order - b.order)
    .map((property, index) => {
      const { name, displayName, type, id } = property;

      return {
        id,
        header: <HeaderCell icon={propertyTypeToIconMap[type] as IconName} header={displayName} />,
        cell: (cellContext: CellContext<any, unknown>) => {
          return <CellComponent property={property} cellContext={cellContext} index={index} />;
        },
        accessorKey: name,
        property,
        index,
        minSize: index === 0 ? 200 : 50,
      };
    });

  return columnDef;
};
