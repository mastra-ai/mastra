import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConditionOperator } from '../types';

import { RuleFieldSelect } from './rule-field-select';
import { RuleOperatorSelect } from './rule-operator-select';
import { RuleValueInput } from './rule-value-input';
import { getFieldOptionAtPath } from './schema-utils';
import type { RuleRowProps } from './types';

import { IconButton } from '@/ds/components/IconButton';

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'integer']);

/**
 * A single rule row with field selector, operator selector, and value input
 */
export const RuleRow: React.FC<RuleRowProps> = ({ schema, rule, onChange, onRemove, className }) => {
  const fieldType = React.useMemo(() => {
    return getFieldOptionAtPath(schema, rule.field)?.type;
  }, [schema, rule.field]);

  const isPrimitive = fieldType !== undefined && PRIMITIVE_TYPES.has(fieldType);
  const isArray = fieldType === 'array';
  const isArrayOperator = rule.operator === 'in' || rule.operator === 'not_in';
  const isExistenceOperator = rule.operator === 'exists' || rule.operator === 'not_exists';

  // Show operator + value for primitive types, or for array types (restricted to in/not_in)
  const showComparator = isPrimitive || isArray;
  const showValueInput = !isExistenceOperator && (isPrimitive || (isArray && isArrayOperator));

  const handleFieldChange = React.useCallback(
    (field: string) => {
      onChange({ ...rule, field });
    },
    [rule, onChange],
  );

  const handleOperatorChange = React.useCallback(
    (operator: ConditionOperator) => {
      const isNewExistence = operator === 'exists' || operator === 'not_exists';

      // Existence operators don't need a value
      if (isNewExistence) {
        onChange({ ...rule, operator, value: undefined });
        return;
      }

      // Reset value when changing to/from array operators
      const isArrayOperator = operator === 'in' || operator === 'not_in';
      const wasArrayOperator = rule.operator === 'in' || rule.operator === 'not_in';

      let newValue = rule.value;
      if (isArrayOperator && !wasArrayOperator) {
        // Converting to array operator: wrap value in array
        newValue = rule.value !== undefined ? [rule.value] : [];
      } else if (!isArrayOperator && wasArrayOperator) {
        // Converting from array operator: take first value
        newValue = Array.isArray(rule.value) ? rule.value[0] : rule.value;
      }

      onChange({ ...rule, operator, value: newValue });
    },
    [rule, onChange],
  );

  const handleValueChange = React.useCallback(
    (value: unknown) => {
      onChange({ ...rule, value });
    },
    [rule, onChange],
  );

  return (
    <div className="flex justify-between gap-2">
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <RuleFieldSelect schema={schema} value={rule.field} onChange={handleFieldChange} />

        {showComparator && (
          <>
            <RuleOperatorSelect
              value={rule.operator}
              onChange={handleOperatorChange}
              operators={isArray ? (['in', 'not_in'] as const) : undefined}
            />

            {showValueInput && (
              <RuleValueInput
                value={rule.value}
                onChange={handleValueChange}
                operator={rule.operator}
                fieldType={fieldType}
              />
            )}
          </>
        )}
      </div>

      <IconButton type="button" onClick={onRemove} tooltip="Remove rule" size="sm" variant="ghost">
        <X />
      </IconButton>
    </div>
  );
};
