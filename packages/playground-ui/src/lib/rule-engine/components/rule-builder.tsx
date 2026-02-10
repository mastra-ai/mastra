import * as React from 'react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Rule } from '../types';

import { RuleRow } from './rule-row';
import type { RuleBuilderProps } from './types';
import { Icon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';

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
export const RuleBuilder: React.FC<RuleBuilderProps> = ({ schema, rules, onChange, groupOperator = 'AND', className }) => {
  const handleAddRule = React.useCallback(() => {
    onChange([...rules, createDefaultRule()], groupOperator);
  }, [rules, onChange, groupOperator]);

  const handleRuleChange = React.useCallback(
    (index: number, updatedRule: Rule) => {
      const newRules = [...rules];
      newRules[index] = updatedRule;
      onChange(newRules, groupOperator);
    },
    [rules, onChange, groupOperator],
  );

  const handleRemoveRule = React.useCallback(
    (index: number) => {
      const newRules = rules.filter((_, i) => i !== index);
      onChange(newRules, groupOperator);
    },
    [rules, onChange, groupOperator],
  );

  const handleToggleOperator = React.useCallback(() => {
    onChange(rules, groupOperator === 'AND' ? 'OR' : 'AND');
  }, [rules, onChange, groupOperator]);

  return (
    <div className={cn('border-t border-border1 bg-surface3 overflow-hidden', className)}>
      {rules.map((rule, index) => (
        <div key={index} className="border-b border-border1 border-dashed">
          <div className="p-4 relative border-l-4 border-border1">
            {index > 0 && (
              <button
                type="button"
                onClick={handleToggleOperator}
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 z-10 -translate-y-1/2 top-0 text-ui-xs px-1.5 rounded-md cursor-pointer',
                  groupOperator === 'OR' ? 'bg-accent2 text-accent6' : 'bg-surface3 text-neutral2',
                )}
              >
                {groupOperator.toLowerCase()}
              </button>
            )}

            <RuleRow
              key={index}
              schema={schema}
              rule={rule}
              onChange={updatedRule => handleRuleChange(index, updatedRule)}
              onRemove={() => handleRemoveRule(index)}
            />
          </div>
        </div>
      ))}

      <div className="p-2">
        <Button type="button" onClick={handleAddRule} variant="ghost" size="sm">
          <Icon>
            <Plus />
          </Icon>
          Add conditional rule
        </Button>
      </div>
    </div>
  );
};
