import * as React from 'react';
import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConditionOperator } from '../types';

import { RuleFieldSelect } from './rule-field-select';
import { RuleOperatorSelect } from './rule-operator-select';
import { RuleValueInput } from './rule-value-input';
import type { RuleRowProps } from './types';
import { IconButton } from '@/ds/components/IconButton';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';

/**
 * A single rule row with field selector, operator selector, and value input
 */
export const RuleRow: React.FC<RuleRowProps> = ({ schema, rule, onChange, onRemove, className }) => {
  const handleFieldChange = React.useCallback(
    (field: string) => {
      onChange({ ...rule, field });
    },
    [rule, onChange],
  );

  const handleOperatorChange = React.useCallback(
    (operator: ConditionOperator) => {
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
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <RuleFieldSelect schema={schema} value={rule.field} onChange={handleFieldChange} />

      <RuleOperatorSelect value={rule.operator} onChange={handleOperatorChange} />

      <RuleValueInput value={rule.value} onChange={handleValueChange} operator={rule.operator} />

      <Button type="button" onClick={onRemove} variant="ghost" size="sm">
        <Icon>
          <Trash2 />
        </Icon>
        Remove rule
      </Button>
    </div>
  );
};
