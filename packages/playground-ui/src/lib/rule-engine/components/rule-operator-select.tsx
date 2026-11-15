import { EqualNot, TextSearch, ListX } from 'lucide-react';
import * as React from 'react';

import type { ConditionOperator } from '../types';
import type { RuleOperatorSelectProps } from './types';
import { OPERATOR_LABELS, OPERATORS } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select/select';
import { Icon } from '@/ds/icons';
import { IconAlignmentLeft } from '@/ds/icons/central/IconAlignmentLeft';
import { IconCheckmark1 } from '@/ds/icons/central/IconCheckmark1';
import { IconChevronDoubleLeft } from '@/ds/icons/central/IconChevronDoubleLeft';
import { IconChevronDoubleRight } from '@/ds/icons/central/IconChevronDoubleRight';
import { IconChevronLeft } from '@/ds/icons/central/IconChevronLeft';
import { IconChevronRight } from '@/ds/icons/central/IconChevronRight';
import { IconCircleBanSign } from '@/ds/icons/central/IconCircleBanSign';
import { IconListBullets } from '@/ds/icons/central/IconListBullets';
import { IconMathEquals } from '@/ds/icons/central/IconMathEquals';
import { cn } from '@/lib/utils';

/**
 * Icons for each operator type
 */
const OPERATOR_ICONS: Record<ConditionOperator, React.ReactNode> = {
  equals: <IconMathEquals />,
  not_equals: <EqualNot />,
  contains: <TextSearch />,
  not_contains: <IconAlignmentLeft />,
  greater_than: <IconChevronRight />,
  less_than: <IconChevronLeft />,
  greater_than_or_equal: <IconChevronDoubleRight />,
  less_than_or_equal: <IconChevronDoubleLeft />,
  in: <IconListBullets />,
  not_in: <ListX />,
  exists: <IconCheckmark1 />,
  not_exists: <IconCircleBanSign />,
};

/**
 * Select component for choosing a rule operator
 */
export const RuleOperatorSelect: React.FC<RuleOperatorSelectProps> = ({ value, onChange, operators, className }) => {
  const operatorList = operators ?? OPERATORS;

  return (
    <div className={cn('relative', className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-muted text-foreground" size="sm">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          {operatorList.map(operator => (
            <SelectItem key={operator} value={operator}>
              <span className="flex items-center gap-2">
                <Icon size="xs" className="text-muted-foreground">
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
