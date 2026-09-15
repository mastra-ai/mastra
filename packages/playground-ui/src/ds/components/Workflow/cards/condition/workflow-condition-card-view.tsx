import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { Braces } from 'lucide-react';
import type { WorkflowConditionCardViewProps } from '../../types';
import { getConditionIndicator } from '../workflow-card-badge-utils';
import { conditionExpression } from './workflow-condition-expression';
import { WorkflowConditionSource } from './workflow-condition-source';
import { Badge } from '@/ds/components/Badge';
import { Code } from '@/ds/components/Code';
import { CopyButton } from '@/ds/components/CopyButton';
import './workflow-condition.css';

export function WorkflowConditionCardView({
  type,
  conditions,
  previousDisplayStatus,
  actionBar,
}: WorkflowConditionCardViewProps) {
  const indicator = getConditionIndicator(type);
  const Icon = indicator?.icon ?? Braces;
  const label = indicator?.label.replace(/ condition$/, '') ?? 'Condition';
  const occurrences = new Map<string, number>();
  const sources = conditions.map(condition => {
    const expression = conditionExpression(condition);
    const identity = `${condition.type}:${expression}`;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { condition, expression, key: `${identity}:${occurrence}` };
  });
  const copyContent =
    conditions.length > 1 ? safeStringify(conditions, 2) : sources.map(source => source.expression).join('\n');
  const hasExpression = type !== 'else' && sources.some(({ expression }) => expression.trim().length > 0);

  return (
    <div
      className="workflow-condition-gate"
      data-workflow-node
      data-testid="workflow-condition-node"
      data-workflow-step-status={previousDisplayStatus ?? 'idle'}
    >
      <div className="workflow-condition-heading">
        <Badge size="xs" variant={type === 'else' ? 'neutral' : 'yellow'} emphasis="muted" icon={<Icon aria-hidden />}>
          {label}
        </Badge>
        {hasExpression && (
          <>
            <span className="ml-auto">Expression</span>
            <CopyButton content={copyContent} tooltip="Copy expression" size="sm" className="nodrag nopan" />
          </>
        )}
      </div>
      {hasExpression ? (
        <div
          role="region"
          aria-label="Condition details"
          tabIndex={0}
          className="workflow-condition-details nodrag nopan nowheel"
        >
          {sources.map(({ condition, expression, key }) => (
            <div key={key}>
              {condition.conj && (
                <Badge size="xs" variant="neutral">
                  {condition.conj.toUpperCase()}
                </Badge>
              )}
              {condition.fnString !== undefined ? (
                <WorkflowConditionSource source={condition.fnString} />
              ) : (
                <Code code={expression} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="workflow-condition-empty">
          {type === 'else' ? 'When no other branch matches' : 'Condition expression unavailable'}
        </p>
      )}
      {actionBar && <div className="workflow-condition-actions nodrag nopan">{actionBar}</div>}
    </div>
  );
}
