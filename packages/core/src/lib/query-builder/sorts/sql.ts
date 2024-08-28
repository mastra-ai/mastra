import { PropertyType } from '@prisma-app/client';
import { SortClauseArgs } from '../types';
import { getJSONField } from '../utils';

/**
 * Get the SQL sort clause for the given sort fields.
 * A sort clause is an array of strings where each string is a field to sort by.
 * e.g. ["field1 ASC", "field2 DESC"] will sort by field1 in ascending order and field2 in descending order.
 */
export const getSortClauseSQL = ({
  sort,
  parentTableRef,
  fields,
}: SortClauseArgs): string[] => {
  if (!parentTableRef) return [];
  return (
    sort
      // filter out invalid sort fields
      .filter(
        (sortField) =>
          sortField.startsWith('asc(') || sortField.startsWith('desc(')
      )
      .map((sortField) => {
        const [order, field] = sortField
          .slice(0, sortField.length - 1)
          .split('(');
        const isJSONField = typeof field.split('.')[1] !== 'undefined';

        if (isJSONField) {
          const [parentField, childField] = field.split('.');
          const fieldType =
            fields?.find((f) => f.name === childField)?.type ||
            PropertyType.SINGLE_LINE_TEXT;
          const JSONField = `"arkw"."${parentTableRef}"."${parentField}"->>'${childField}'`;
          const column = getJSONField(JSONField, fieldType);
          return `${column} ${order.toUpperCase()}`;
        }
        return `"arkw"."${parentTableRef}"."${field}" ${order.toUpperCase()}`;
      })
  );
};
