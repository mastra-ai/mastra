import * as React from 'react';
import { Hash, ToggleLeft, Type } from 'lucide-react';

import { Input } from '@/ds/components/Input/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { Icon } from '@/ds/icons';
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
 * Converts a boolean value to a string for the select
 */
const booleanToString = (value: unknown): string => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
};

type BaseInputProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Boolean value input using a Select dropdown with icon inside
 */
const BooleanValueInput: React.FC<BaseInputProps> = ({ value, onChange, className }) => {
  const stringValue = booleanToString(value);

  const handleChange = React.useCallback(
    (newValue: string) => {
      onChange(newValue === 'true');
    },
    [onChange],
  );

  return (
    <div className={cn('relative', className)}>
      <Icon size="sm" className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral3 pointer-events-none z-10">
        <ToggleLeft />
      </Icon>
      <Select value={stringValue} onValueChange={handleChange}>
        <SelectTrigger className="min-w-[140px] bg-surface4 pl-7" size="sm">
          <SelectValue placeholder="Select value" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * Number value input with icon inside
 */
const NumberValueInput: React.FC<BaseInputProps> = ({ value, onChange, placeholder, className }) => {
  const displayValue = value === undefined || value === '' ? '' : String(value);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (inputValue === '') {
        onChange('');
      } else {
        const num = Number(inputValue);
        onChange(Number.isNaN(num) ? inputValue : num);
      }
    },
    [onChange],
  );

  return (
    <div className={cn('relative', className)}>
      <Icon size="sm" className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral3 pointer-events-none">
        <Hash />
      </Icon>
      <Input
        type="number"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder || 'Enter number'}
        className="min-w-[140px] bg-surface4 pl-7"
        size="sm"
      />
    </div>
  );
};

/**
 * Text value input with icon inside
 */
const TextValueInput: React.FC<BaseInputProps> = ({ value, onChange, placeholder, className }) => {
  const displayValue = valueToString(value);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseValue(e.target.value));
    },
    [onChange],
  );

  return (
    <div className={cn('relative', className)}>
      <Icon size="sm" className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral3 pointer-events-none">
        <Type />
      </Icon>
      <Input
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder || 'Enter value'}
        className="min-w-[140px] bg-surface4 pl-7"
        size="sm"
      />
    </div>
  );
};

/**
 * Array value input (for "in" and "not_in" operators)
 */
const ArrayValueInput: React.FC<BaseInputProps> = ({ value, onChange, placeholder, className }) => {
  const displayValue = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value.map(valueToString).join(', ');
    }
    return valueToString(value);
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseArrayValue(e.target.value));
    },
    [onChange],
  );

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder || 'Enter values (comma-separated)'}
      className={cn('min-w-[160px] bg-surface4', className)}
      size="sm"
    />
  );
};

/**
 * Input component for entering rule values
 * Supports different modes based on the operator and field type:
 * - "in" and "not_in": Comma-separated values (parsed as array)
 * - Boolean fields: Select dropdown with true/false
 * - Number fields: Number input
 * - Other: Text input
 */
export const RuleValueInput: React.FC<RuleValueInputProps> = ({
  value,
  onChange,
  operator,
  fieldType,
  placeholder,
  className,
}) => {
  const isArrayOperator = operator === 'in' || operator === 'not_in';

  // Array operators always use text input for comma-separated values
  if (isArrayOperator) {
    return <ArrayValueInput value={value} onChange={onChange} placeholder={placeholder} className={className} />;
  }

  // Boolean fields use Select dropdown
  if (fieldType === 'boolean') {
    return <BooleanValueInput value={value} onChange={onChange} placeholder={placeholder} className={className} />;
  }

  // Number fields use number input
  if (fieldType === 'number' || fieldType === 'integer') {
    return <NumberValueInput value={value} onChange={onChange} placeholder={placeholder} className={className} />;
  }

  // Default to text input
  return <TextValueInput value={value} onChange={onChange} placeholder={placeholder} className={className} />;
};
