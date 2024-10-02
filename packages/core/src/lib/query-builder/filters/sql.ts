import { UTCDate } from '@date-fns/utc';
import { PropertyType } from '@prisma-app/client';
import { endOfDay, startOfDay } from 'date-fns';

import { FilterClauseArgs, FilterOperators } from '../types';
import { FieldTypePrimitiveMap, FilterOperatorToSQL } from '../constants';
import { getJSONField, splitAndStripQuotes } from '../utils';

/**
 * Get the SQL filter clause for the given filters.
 * @param filters - Filters to apply.
 * @param fields - Optional. JSON fields with associated types to apply filters on.
 * @param parentTableRef - Parent table reference to apply filters on.
 */
export const getFilterClauseSQL = ({
  filters,
  fields,
  parentTableRef,
}: FilterClauseArgs<string>) => {
  if (!parentTableRef || !Object.keys(filters).length) return '';

  const getValue = (value: any, primitiveType: string, isMultiple: boolean) => {
    if (isMultiple) {
      const multipleValues = splitAndStripQuotes(value);
      return `(${multipleValues
        .map((v) =>
          primitiveType === 'number' ? `${Number(v)}::bigint` : `'${v}'`
        )
        .join(',')})`;
    }

    switch (primitiveType) {
      case 'number': {
        // cast to number if field is numeric
        return `${Number(value)}::bigint`;
      }

      case 'boolean': {
        // cast to boolean if field is boolean
        return `${value}::boolean`;
      }

      case 'string': {
        return `'${value}'`;
      }

      case 'date': {
        return `'${value}'::timestamp`;
      }

      default: {
        return value;
      }
    }
  };

  const getFilterClause = (
    table: string,
    field: string,
    filter: Record<FilterOperators, any>
  ) => {
    let fieldType =
      fields?.find((f) => field.startsWith(f.name))?.type ||
      PropertyType.SINGLE_LINE_TEXT;
    let column = `"mastra"."${table}"."${field}"`;
    const operators = Object.keys(filter) as FilterOperators[];
    const logicOperator = filter.op || 'or';

    const isJSONField = field.includes('.');

    // JSON fields contains a parent field and a child field. e.g. data.amount
    if (isJSONField) {
      const [parentField, childField] = field.split('.');
      fieldType =
        fields?.find((f) => f.name === childField)?.type ||
        PropertyType.SINGLE_LINE_TEXT;
      const JSONField = `"mastra"."${table}"."${parentField}"->>'${childField}'`;
      column = getJSONField(JSONField, fieldType);
    }

    const primitiveType =
      FieldTypePrimitiveMap[fieldType || PropertyType.SINGLE_LINE_TEXT];

    const clauses = operators
      .filter((op) => op !== FilterOperators.OP)
      .map((op) => {
        const isContains =
          op === FilterOperators.CONTAINS ||
          op === FilterOperators.NOT_CONTAINS;
        const isSetOperator =
          op === FilterOperators.SET || op === FilterOperators.NOT_SET;
        const isINOperator =
          op === FilterOperators.IN || op === FilterOperators.NOT_IN;
        const operatorSQL = FilterOperatorToSQL[op];

        const inputValues: string[] = Array.isArray(filter[op])
          ? filter[op]
          : [filter[op]];
        const queryValues = isContains
          ? // if operator is 'contains', we use POSIX regex to match any the values
            [`'.*${inputValues.join('.*|.*')}.*'`] // e.g. ['foo', 'bar'] => /.*foo.*|.*bar.*/
          : // limitation of this is that we can't have `AND` clauses for the `contains` operator
            // else, we use the value as is
            // N/B: in and not_in operators are handled differently as they're not transformed to arrays
            inputValues.map((v) =>
              getValue(v, primitiveType, isINOperator && v.includes(','))
            );

        if (primitiveType === `date` && !isSetOperator) {
          const hasTimezone = filter[op].toLowerCase().includes('z');
          const inputVal = new UTCDate(
            hasTimezone ? filter[op] : `${filter[op]}Z`
          );

          const startDayVal = getValue(
            startOfDay(inputVal).toISOString(),
            primitiveType,
            false
          );
          const endDayVal = getValue(
            endOfDay(inputVal).toISOString(),
            primitiveType,
            false
          );

          if (op === `eq`) {
            return `((${column} >= ${startDayVal}) AND (${column} <= ${endDayVal}))`;
          } else if (op === `lt`) {
            return `(${column} ${operatorSQL} ${startDayVal})`;
          } else if (op === `gt`) {
            return `(${column} ${operatorSQL} ${endDayVal})`;
          } else if (op === `lte`) {
            return `(${column} ${operatorSQL} ${endDayVal})`;
          } else if (op === `gte`) {
            return `(${column} ${operatorSQL} ${startDayVal})`;
          } else if (op === `not_eq`) {
            return `((${column} < ${startDayVal}) OR (${column} > ${endDayVal}))`;
          }
        }

        return `(${queryValues
          .map((value) =>
            isSetOperator
              ? `(${column} ${operatorSQL})`
              : `(${column} ${operatorSQL} ${value})`
          )
          .join(` ${logicOperator.toUpperCase()} `)})`;
      });

    const filterClause = `(${clauses.join(
      ` ${logicOperator.toUpperCase()} `
    )})`;
    return filterClause;
  };

  const combinedFields = Object.keys(filters).filter((field) =>
    field.includes(',')
  );
  const normalFields = Object.keys(filters).filter(
    (field) => !field.includes(',')
  );
  const filterClauseMap: Record<string, string[]> = normalFields.reduce(
    (acc, field) => {
      return {
        ...acc,
        [field]: getFilterClause(
          parentTableRef,
          field,
          filters[field] as Record<FilterOperators, any>
        ),
      };
    },
    {}
  );

  const combinedFilterClauses = combinedFields.map((field) => {
    const fields = field.split(',');
    const logicGroupOperator = filters[field].op || 'and';
    const clauses = fields.map((f) => filterClauseMap[f]);
    return `(${clauses.join(` ${logicGroupOperator.toUpperCase()} `)})`;
  });

  const normalFilterClauses = Object.entries(filterClauseMap)
    .map(([field, clause]) =>
      combinedFields.some((f) => f.includes(field)) ? [] : clause
    )
    .flat();

  return `(${[...combinedFilterClauses, ...normalFilterClauses].join(
    ' AND '
  )})`;
};
