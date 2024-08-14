import { TextField } from '../fields/text-field';

export const CellComponent = ({ field, cellContext, index }: { field: any; cellContext: any; index: number }) => {
  const value = cellContext.getValue();
  const row = cellContext.row.original;
  const component = fieldTypeToComponentMap[field.type];

  if (component) {
    return <>{component(value, field, index, row)}</>;
  }

  return <></>;
};

export const fieldTypeToComponentMap: Record<
  string,
  (value: any, field: any, index: number, row: Record<string, any>) => React.ReactNode
> = {
  SINGLE_LINE_TEXT: (value, field) => {
    return <TextField value={value} field={field} />;
  },
};
