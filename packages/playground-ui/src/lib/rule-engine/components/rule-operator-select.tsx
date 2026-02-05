import * as React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { cn } from '@/lib/utils';

import type { RuleOperatorSelectProps } from './types';
import { OPERATOR_LABELS, OPERATORS } from './types';

/**
 * Select component for choosing a rule operator
 */
export const RuleOperatorSelect: React.FC<RuleOperatorSelectProps> = ({ value, onChange, className }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('min-w-[120px] text-neutral6 bg-surface4', className)} size="sm">
        <SelectValue placeholder="Select operator" />
      </SelectTrigger>
      <SelectContent>
        {OPERATORS.map(operator => (
          <SelectItem key={operator} value={operator}>
            {OPERATOR_LABELS[operator]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
