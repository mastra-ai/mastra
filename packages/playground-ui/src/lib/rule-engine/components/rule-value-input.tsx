import * as React from 'react';

import { Input } from '@/ds/components/Input/input';
import { cn } from '@/lib/utils';

import type { RuleValueInputProps } from './types';

/**
 * Parses a string value to the appropriate type
 */
const parseValue = (stringValue: string): unknown => {
  const trimmed = stringValue.trim();

  // Empty string
  if (trimmed === '') return '';

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null
  if (trimmed === 'null') return null;

  // Reject special number strings - keep as strings
  const lowerTrimmed = trimmed.toLowerCase();
  if (lowerTrimmed === 'infinity' || lowerTrimmed === '-infinity' || lowerTrimmed === 'nan') {
    return trimmed;
  }

  // Number
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;

  // String (default)
  return stringValue;
};

/**
 * Parses a comma-separated string into an array of values
 */
const parseArrayValue = (stringValue: string): unknown[] => {
  if (stringValue.trim() === '') return [];

  return stringValue.split(',').map(item => parseValue(item.trim()));
};

/**
 * Converts a value to a display string
 */
const valueToString = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.map(valueToString).join(', ');
  return String(value);
};

/**
 * Input component for entering rule values
 * Supports different modes based on the operator:
 * - "in" and "not_in": Comma-separated values (parsed as array)
 * - Other operators: Single value input
 */
export const RuleValueInput: React.FC<RuleValueInputProps> = ({
  value,
  onChange,
  operator,
  placeholder,
  className,
}) => {
  const isArrayOperator = operator === 'in' || operator === 'not_in';

  // Convert the current value to a display string
  const displayValue = React.useMemo(() => {
    if (isArrayOperator && Array.isArray(value)) {
      return value.map(valueToString).join(', ');
    }
    return valueToString(value);
  }, [value, isArrayOperator]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      if (isArrayOperator) {
        onChange(parseArrayValue(inputValue));
      } else {
        onChange(parseValue(inputValue));
      }
    },
    [onChange, isArrayOperator],
  );

  const defaultPlaceholder = isArrayOperator ? 'Enter values (comma-separated)' : 'Enter value';

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || defaultPlaceholder}
      className={cn('min-w-[160px] bg-surface4', className)}
      size="sm"
    />
  );
};
