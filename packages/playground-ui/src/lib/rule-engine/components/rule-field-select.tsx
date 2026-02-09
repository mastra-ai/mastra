import * as React from 'react';
import { Braces, Hash, List, ToggleLeft, Type } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

import type { FieldOption, RuleFieldSelectProps } from './types';
import { getFieldOptionsFromSchema, getFieldOptionAtPath, getChildFieldOptions, parseFieldPath } from './schema-utils';

/**
 * Get icon for a field type
 */
const getFieldTypeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'object':
      return <Braces />;
    case 'array':
      return <List />;
    case 'number':
    case 'integer':
      return <Hash />;
    case 'boolean':
      return <ToggleLeft />;
    case 'string':
    default:
      return <Type />;
  }
};

/**
 * A single level of field selection
 */
type FieldLevelSelectProps = {
  options: FieldOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const FieldLevelSelect: React.FC<FieldLevelSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select field',
  className,
}) => {
  return (
    <div className={cn('relative', className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-[140px] text-neutral6 bg-surface4" size="sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.path} value={option.path}>
              <span className="flex items-center gap-2">
                <Icon size="sm" className="text-neutral3">
                  {getFieldTypeIcon(option.type)}
                </Icon>
                {option.label}
                {option.hasChildren && <span className="text-neutral3">...</span>}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * Recursive field selector that shows additional dropdowns for nested objects/arrays
 */
export const RuleFieldSelect: React.FC<RuleFieldSelectProps> = ({ schema, value, onChange, className }) => {
  // Parse the current path into segments
  const pathSegments = React.useMemo(() => parseFieldPath(value), [value]);

  // Build the list of selectors needed based on the current value
  const selectors = React.useMemo(() => {
    const result: Array<{
      options: FieldOption[];
      value: string;
      basePath: string;
    }> = [];

    // First level: root schema properties
    const rootOptions = getFieldOptionsFromSchema(schema);
    if (rootOptions.length === 0) return result;

    result.push({
      options: rootOptions,
      value: pathSegments[0] || '',
      basePath: '',
    });

    // For each segment, check if we need to add more selectors
    let currentPath = '';
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;

      const fieldOption = getFieldOptionAtPath(schema, currentPath);
      if (!fieldOption || !fieldOption.hasChildren) break;

      // Get child options for the next level
      const childOptions = getChildFieldOptions(fieldOption, currentPath);
      if (childOptions.length === 0) break;

      // Check if there's a next segment selected
      const nextSegment = pathSegments[i + 1];
      const nextPath = nextSegment ? `${currentPath}.${nextSegment}` : '';

      result.push({
        options: childOptions,
        value: nextPath,
        basePath: currentPath,
      });
    }

    return result;
  }, [schema, pathSegments]);

  // Handle change at a specific level
  const handleChange = React.useCallback(
    (levelIndex: number, newValue: string) => {
      // When changing a level, we truncate any deeper selections
      onChange(newValue);
    },
    [onChange],
  );

  if (selectors.length === 0) {
    return <div className={cn('text-sm text-neutral3', className)}>No fields available</div>;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {selectors.map((selector, index) => (
        <React.Fragment key={`${selector.basePath}-${index}`}>
          {index > 0 && <span className="text-neutral3">.</span>}
          <FieldLevelSelect
            options={selector.options}
            value={selector.value}
            onChange={newValue => handleChange(index, newValue)}
            placeholder={index === 0 ? 'Select field' : 'Select property'}
          />
        </React.Fragment>
      ))}
    </div>
  );
};
