import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Rule, RuleGroup } from '../types';
import { isRule, createDefaultRule, createDefaultRuleGroup } from '../utils';

import { RuleRow } from './rule-row';
import type { RuleBuilderProps, RuleGroupViewProps } from './types';
import { Icon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';
import { IconButton } from '@/ds/components/IconButton';

const DEFAULT_MAX_DEPTH = 3;

/**
 * Internal recursive component that renders one level of a rule group.
 */
const RuleGroupView: React.FC<RuleGroupViewProps> = ({ schema, group, onChange, onRemove, depth, maxDepth }) => {
  const isRoot = depth === 0;

  const handleToggleOperator = React.useCallback(() => {
    onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' });
  }, [group, onChange]);

  const handleConditionChange = React.useCallback(
    (index: number, condition: Rule | RuleGroup) => {
      const newConditions = [...group.conditions];
      newConditions[index] = condition;
      onChange({ ...group, conditions: newConditions });
    },
    [group, onChange],
  );

  const handleRemoveCondition = React.useCallback(
    (index: number) => {
      const newConditions = group.conditions.filter((_, i) => i !== index);
      if (newConditions.length === 0 && onRemove) {
        onRemove();
      } else {
        onChange({ ...group, conditions: newConditions });
      }
    },
    [group, onChange, onRemove],
  );

  const handleAddRule = React.useCallback(() => {
    onChange({ ...group, conditions: [...group.conditions, createDefaultRule()] });
  }, [group, onChange]);

  const handleAddGroup = React.useCallback(() => {
    onChange({
      ...group,
      conditions: [...group.conditions, createDefaultRuleGroup(group.operator === 'AND' ? 'OR' : 'AND')],
    });
  }, [group, onChange]);

  return (
    <div
      className={cn(
        isRoot ? 'border-t border-border1 bg-surface3 overflow-hidden' : 'ml-6 border border-dashed border-border1 rounded-md bg-surface2 overflow-hidden',
      )}
    >
      {/* Non-root group header */}
      {!isRoot && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface3 border-b border-border1 border-dashed">
          <span className="text-ui-xs text-neutral3">Group</span>
          {onRemove && (
            <IconButton type="button" onClick={onRemove} tooltip="Remove group" size="sm" variant="ghost">
              <X />
            </IconButton>
          )}
        </div>
      )}

      {group.conditions.map((condition, index) => (
        <div key={index} className="border-b border-border1 border-dashed last:border-b-0">
          <div className={cn('relative', isRule(condition) && 'p-4 border-l-4 border-border1')}>
            {index > 0 && (
              <button
                type="button"
                onClick={handleToggleOperator}
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 z-10 -translate-y-1/2 top-0 text-ui-xs px-1.5 rounded-md cursor-pointer',
                  group.operator === 'OR' ? 'bg-accent2 text-accent6' : 'bg-surface3 text-neutral2',
                )}
              >
                {group.operator.toLowerCase()}
              </button>
            )}

            {isRule(condition) ? (
              <RuleRow
                schema={schema}
                rule={condition}
                onChange={updatedRule => handleConditionChange(index, updatedRule)}
                onRemove={() => handleRemoveCondition(index)}
              />
            ) : (
              <RuleGroupView
                schema={schema}
                group={condition}
                onChange={updatedGroup => handleConditionChange(index, updatedGroup)}
                onRemove={() => handleRemoveCondition(index)}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            )}
          </div>
        </div>
      ))}

      <div className="p-2 flex gap-1">
        <Button type="button" onClick={handleAddRule} variant="ghost" size="sm">
          <Icon>
            <Plus />
          </Icon>
          Add rule
        </Button>
        {depth < maxDepth - 1 && (
          <Button type="button" onClick={handleAddGroup} variant="ghost" size="sm">
            <Icon>
              <Plus />
            </Icon>
            Add group
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Rule builder component for creating and managing a recursive set of rules
 * based on a JSON Schema defining available fields.
 *
 * Supports nested rule groups with AND/OR operators at each level.
 */
export const RuleBuilder: React.FC<RuleBuilderProps> = ({ schema, ruleGroup, onChange, maxDepth = DEFAULT_MAX_DEPTH, className }) => {
  const handleGroupChange = React.useCallback(
    (group: RuleGroup) => {
      onChange(group);
    },
    [onChange],
  );

  const handleAddFirstRule = React.useCallback(() => {
    onChange({ operator: 'AND', conditions: [createDefaultRule()] });
  }, [onChange]);

  if (!ruleGroup) {
    return (
      <div className={cn('border-t border-border1 bg-surface3 overflow-hidden', className)}>
        <div className="p-2">
          <Button type="button" onClick={handleAddFirstRule} variant="ghost" size="sm">
            <Icon>
              <Plus />
            </Icon>
            Add conditional rule
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <RuleGroupView schema={schema} group={ruleGroup} onChange={handleGroupChange} depth={0} maxDepth={maxDepth} />
    </div>
  );
};
