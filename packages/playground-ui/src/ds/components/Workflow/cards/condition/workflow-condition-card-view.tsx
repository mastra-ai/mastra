import { Braces } from 'lucide-react';
import type { WorkflowConditionCardViewProps } from '../../types';
import { getConditionIndicator } from '../workflow-card-badge-utils';
import { conditionExpression } from './workflow-condition-expression';
import { WorkflowConditionSource } from './workflow-condition-source';
import { Badge } from '@/ds/components/Badge';
import { Code } from '@/ds/components/Code';
import { CopyButton } from '@/ds/components/CopyButton';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const surfaceClasses = 'rounded-[calc(var(--radius-xl)-2px)] bg-card text-meta';

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
    conditions.length > 1 ? JSON.stringify(conditions, null, 2) : sources.map(source => source.expression).join('\n');
  const hasExpression = type !== 'else' && sources.some(({ expression }) => expression.trim().length > 0);

  return (
    <div
      className={`${raisedSurfaceStyle} has-focus-visible:outline-accent3 w-[274px] overflow-hidden rounded-xl p-0.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-4`}
      data-workflow-node
      data-testid="workflow-condition-node"
      data-workflow-step-status={previousDisplayStatus ?? 'idle'}
    >
      <div className="text-meta text-muted-foreground flex h-[46px] items-center gap-2 px-2.5">
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
          className={`${surfaceClasses} text-foreground nodrag nopan nowheel max-h-[220px] overflow-auto p-3.5 [&_pre]:leading-relaxed [&_pre]:whitespace-pre-wrap`}
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
        <p className={`${surfaceClasses} text-muted-foreground p-3`}>
          {type === 'else' ? 'When no other branch matches' : 'Condition expression unavailable'}
        </p>
      )}
      {actionBar && <div className="nodrag nopan flex justify-end px-2.5 py-1.5 empty:hidden">{actionBar}</div>}
    </div>
  );
}
