import * as React from 'react';
import {
  Equal,
  EqualNot,
  Text,
  TextSearch,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  List,
  ListX,
  Check,
  Ban,
} from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

import type { ConditionOperator } from '../types';
import type { RuleOperatorSelectProps } from './types';
import { OPERATOR_LABELS, OPERATORS } from './types';

/**
 * Icons for each operator type
 */
const OPERATOR_ICONS: Record<ConditionOperator, React.ReactNode> = {
  equals: <Equal />,
  not_equals: <EqualNot />,
  contains: <TextSearch />,
  not_contains: <Text />,
  greater_than: <ChevronRight />,
  less_than: <ChevronLeft />,
  greater_than_or_equal: <ChevronsRight />,
  less_than_or_equal: <ChevronsLeft />,
  in: <List />,
  not_in: <ListX />,
  exists: <Check />,
  not_exists: <Ban />,
};

/**
 * Select component for choosing a rule operator
 */
export const RuleOperatorSelect: React.FC<RuleOperatorSelectProps> = ({ value, onChange, operators, className }) => {
  const operatorList = operators ?? OPERATORS;

  return (
    <div className={cn('relative', className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-transparent border-0 rounded-none shadow-none focus:ring-0 focus:shadow-none text-neutral6" size="sm">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          {operatorList.map(operator => (
            <SelectItem key={operator} value={operator}>
              <span className="flex items-center gap-2">
                <Icon size="sm" className="text-neutral3">
                  {OPERATOR_ICONS[operator]}
                </Icon>
                {OPERATOR_LABELS[operator]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
