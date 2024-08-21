import { PropertyType } from '@prisma-app/client';
import { FieldTypePrimitiveMap } from './constants';

/**
 * Split a string on commas and strip quotes from each part
 * @param str input string
 * @returns array of strings
 */
export const splitAndStripQuotes = (str: string) => {
  // Raw regex pattern for splitting on non-quoted commas
  const pattern = /,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  // Split the string
  const parts = str.split(pattern);
  // Strip quotes from each part
  const cleanedParts = parts.map((part) => part.trim().replace(/^"|"$/g, ''));
  return cleanedParts;
};

export const transformFilterValueArray = (value: string | undefined) => {
  if (typeof value === 'string') return value.split(',');
  return value;
};

export const transformFilterValueBoolean = (value: string | undefined) => {
  if (typeof value === 'string') return value === 'true';
  return value;
};

/**
 * This returns the SQL field for a JSON field with appropriate casting.
 * @param column - JSON field to cast.
 * @param type - Type of the JSON field.
 */
export const getJSONField = (column: string, type: PropertyType) => {
  const primitiveType = FieldTypePrimitiveMap[type];

  switch (primitiveType) {
    case 'number': {
      // cast to number if field is numeric
      return `(${column})::bigint`;
    }

    case 'boolean': {
      // cast to boolean if field is boolean
      return `(${column})::boolean`;
    }

    case 'date': {
      return `(${column})::timestamp`;
    }
  }

  return `(${column})::text`;
};

/**
 * @description
 * Builds a query string from filter and sort query strings
 * @param filterQueryString Filter query string
 * @param sortQueryString Sort query string
 * @returns
 */
export function buildQueryString({
  filterQueryString,
  sortQueryString,
}: {
  filterQueryString?: string;
  sortQueryString?: string;
}) {
  if (!filterQueryString && !sortQueryString) return '';
  if (!filterQueryString) return `${sortQueryString}`;
  if (!sortQueryString) return `${filterQueryString}`;

  return `${filterQueryString}&${sortQueryString}`;
}
