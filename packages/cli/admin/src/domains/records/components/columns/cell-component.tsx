import { TextField } from '../fields/text-field';

export const CellComponent = ({ property, cellContext, index }: { property: any; cellContext: any; index: number }) => {
  const value = cellContext.getValue();
  const row = cellContext.row.original;
  const component = propertyTypeToComponentMap[property.type];

  if (component) {
    return <>{component(value, property, index, row)}</>;
  }

  return <></>;
};

export const propertyTypeToComponentMap: Record<
  string,
  (value: any, property: any, index: number, row: Record<string, any>) => React.ReactNode
> = {
  SINGLE_LINE_TEXT: (value, property) => {
    return <TextField value={value} property={property} />;
  },
};
