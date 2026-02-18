import * as React from 'react';
import { Plus, X } from 'lucide-react';

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
 * AND/OR connector rendered between conditions as a horizontal line with centered pill
 */
const ConditionConnector: React.FC<{ operator: 'AND' | 'OR'; onToggle: () => void }> = ({ operator, onToggle }) => (
  <div className="relative flex items-center w-full">
    <div className="flex-1 border-t border-border1" />
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'text-ui-xs px-3 py-0.5 rounded-full cursor-pointer shrink-0',
        operator === 'OR'
          ? 'bg-accent6Dark text-accent6 hover:bg-accent6Dark/70'
          : 'bg-accent3Dark text-accent3 hover:bg-accent3Dark/70',
      )}
    >
      {operator.toLowerCase()}
    </button>
    <div className="flex-1 border-t border-border1" />
  </div>
);

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

  if (!isRoot) {
    return (
      <div className="rounded-md border border-border1 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-ui-xs text-neutral3 uppercase tracking-wide">Group</span>
          {onRemove && (
            <IconButton type="button" onClick={onRemove} tooltip="Remove group" size="sm" variant="ghost">
              <X />
            </IconButton>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {group.conditions.map((condition, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ConditionConnector operator={group.operator} onToggle={handleToggleOperator} />}
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
            </React.Fragment>
          ))}
        </div>

        <div className="pt-3">
          <Button type="button" onClick={handleAddRule} variant="ghost" size="sm">
            <Icon>
              <Plus />
            </Icon>
            Add rule
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {group.conditions.map((condition, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ConditionConnector operator={group.operator} onToggle={handleToggleOperator} />}
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
        </React.Fragment>
      ))}

      <div className="pt-2 flex gap-1">
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
