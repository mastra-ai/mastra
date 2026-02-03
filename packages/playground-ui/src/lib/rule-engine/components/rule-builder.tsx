import * as React from 'react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Rule } from '../types';

import { RuleRow } from './rule-row';
import type { RuleBuilderProps } from './types';

/**
 * Creates a default empty rule
 */
const createDefaultRule = (): Rule => ({
  field: '',
  operator: 'equals',
  value: '',
});

/**
 * Rule builder component for creating and managing a set of rules
 * based on a JSON Schema defining available fields
 */
export const RuleBuilder: React.FC<RuleBuilderProps> = ({ schema, rules, onChange, className }) => {
  const handleAddRule = React.useCallback(() => {
    onChange([...rules, createDefaultRule()]);
  }, [rules, onChange]);

  const handleRuleChange = React.useCallback(
    (index: number, updatedRule: Rule) => {
      const newRules = [...rules];
      newRules[index] = updatedRule;
      onChange(newRules);
    },
    [rules, onChange],
  );

  const handleRemoveRule = React.useCallback(
    (index: number) => {
      const newRules = rules.filter((_, i) => i !== index);
      onChange(newRules);
    },
    [rules, onChange],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {rules.length > 0 && (
        <div className="flex flex-col gap-2">
          {rules.map((rule, index) => (
            <RuleRow
              key={index}
              schema={schema}
              rule={rule}
              onChange={updatedRule => handleRuleChange(index, updatedRule)}
              onRemove={() => handleRemoveRule(index)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddRule}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm',
          'text-neutral4 hover:text-neutral5',
          'border border-dashed border-border1 hover:border-border2',
          'rounded-md bg-transparent hover:bg-surface2',
          'transition-all duration-normal',
        )}
      >
        <Plus className="h-4 w-4" />
        Add rule
      </button>

      {rules.length > 1 && <p className="text-xs text-neutral3 mt-1">All rules must match (AND logic)</p>}
    </div>
  );
};
