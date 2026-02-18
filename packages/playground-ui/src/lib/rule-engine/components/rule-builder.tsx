import * as React from 'react';
import { Plus, X, Component } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Rule, RuleGroup, RuleGroupDepth1 } from '../types';
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

  const handleToggleOperator = () => {
    onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' });
  };

  const handleConditionChange = (index: number, condition: Rule | RuleGroup) => {
    onChange({
      ...group,
      conditions: group.conditions.map((c, i) => (i === index ? (condition as Rule | RuleGroupDepth1) : c)),
    });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0 && onRemove) {
      onRemove();
    } else {
      onChange({ ...group, conditions: newConditions });
    }
  };

  const handleAddRule = () => {
    onChange({ ...group, conditions: [...group.conditions, createDefaultRule()] });
  };

  const handleAddGroup = () => {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        createDefaultRuleGroup(group.operator === 'AND' ? 'OR' : 'AND') as RuleGroupDepth1,
      ],
    });
  };

  return (
    <div className={cn(isRoot ? 'bg-surface2' : 'pl-6 bg-surface3')}>
      {/* Non-root group header */}
      {!isRoot && (
        <div className="flex items-center justify-between pl-3 pr-4 py-1.5 border-b border-border1 border-dashed">
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
                  'absolute left-1/2 -translate-x-1/2 z-10 -translate-y-1/2 top-0 text-ui-xs px-3 py-0.5 rounded-full cursor-pointer',
                  group.operator === 'OR'
                    ? 'bg-accent6Dark text-accent6 hover:bg-accent6Dark/70'
                    : 'bg-accent3Dark text-accent3 hover:bg-accent3Dark/70',
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
              <Component />
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
export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  schema,
  ruleGroup,
  onChange,
  maxDepth = DEFAULT_MAX_DEPTH,
  className,
}) => {
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
      <button
        type="button"
        onClick={handleAddFirstRule}
        className="flex items-center justify-center gap-2 text-ui-sm text-neutral3 hover:text-neutral6 w-full border border-dashed border-border1 p-2 rounded-md"
      >
        <Icon>
          <Plus />
        </Icon>
        Add conditional rule
      </button>
    );
  }

  return (
    <div className={className}>
      <RuleGroupView schema={schema} group={ruleGroup} onChange={handleGroupChange} depth={0} maxDepth={maxDepth} />
    </div>
  );
};
