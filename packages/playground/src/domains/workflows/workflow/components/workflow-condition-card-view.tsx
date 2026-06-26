import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown } from 'lucide-react';
import { Fragment } from 'react';

import type { WorkflowConditionCardViewProps, WorkflowConditionCodeCondition } from './types';
import { getConditionIndicator, getWorkflowCardAccentColor } from './workflow-card-badge-utils';
import { WorkflowCardBadges } from './workflow-card-badges';
import { WorkflowConditionCode, WorkflowConditionDialog } from './workflow-condition-code';

const isCodeCondition = (
  condition: WorkflowConditionCardViewProps['conditions'][number],
): condition is WorkflowConditionCodeCondition => Boolean(condition.fnString);

export const WorkflowConditionCardView = ({
  type,
  conditions,
  previousDisplayStatus,
  isOpen,
  onOpenChange,
  openDialog,
  onOpenDialogChange,
  dialogCondition,
  onConditionClick,
  actionBar,
}: WorkflowConditionCardViewProps) => {
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions.length > 1) && type !== 'else';
  const conditionIndicator = getConditionIndicator(type);
  const indicators = conditionIndicator ? [conditionIndicator] : [];
  const accentColor = getWorkflowCardAccentColor(indicators);

  return (
    <div
      data-workflow-node
      data-workflow-step-status={previousDisplayStatus ?? 'idle'}
      data-testid="workflow-condition-node"
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      className={cn('bg-surface3 rounded-lg w-dropdown-max-height border border-border1', accentColor && 'border-l-4')}
    >
      <Collapsible
        open={!isCollapsible ? true : isOpen}
        onOpenChange={(_open: boolean) => {
          if (isCollapsible) {
            onOpenChange(_open);
          }
        }}
      >
        <div className="flex items-center gap-1 w-full px-3 py-2">
          {isCollapsible && (
            <CollapsibleTrigger
              aria-label={isOpen ? 'Collapse condition' : 'Expand condition'}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral3 hover:text-neutral5 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1"
            >
              <Icon>
                <ChevronDown
                  className={cn('transition-transform', {
                    'transform rotate-180': isOpen,
                  })}
                />
              </Icon>
            </CollapsibleTrigger>
          )}
          <WorkflowCardBadges indicators={indicators} className="shrink-0" />
          <div className="ml-auto flex shrink-0 items-center">{actionBar}</div>
        </div>

        {type === 'else' ? null : (
          <CollapsibleContent className="flex flex-col gap-2 pb-2">
            {conditions.map((condition, index) => {
              const conjType = condition.conj || type;
              const conjIndicator = index === 0 ? undefined : getConditionIndicator(conjType);
              const conjIndicators = conjIndicator ? [conjIndicator] : [];

              return isCodeCondition(condition) ? (
                <WorkflowConditionCode
                  key={`condition-code-${index}-${condition.fnString}`}
                  condition={condition}
                  onOpen={() => onConditionClick(condition)}
                />
              ) : (
                <Fragment key={`condition-ref-${index}-${condition.ref?.path ?? 'unknown'}`}>
                  {condition.ref?.step ? (
                    <div className="flex items-center gap-1">
                      <WorkflowCardBadges indicators={conjIndicators} />
                      <Txt variant="ui-xs" className=" text-neutral3 flex-1">
                        {typeof condition.ref.step === 'string' ? condition.ref.step : condition.ref.step.id}'s{' '}
                        {condition.ref.path}{' '}
                        {Object.entries(condition.query).map(([key, value]) => `${key} ${String(value)}`)}
                      </Txt>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </CollapsibleContent>
        )}
      </Collapsible>

      <WorkflowConditionDialog open={openDialog} onOpenChange={onOpenDialogChange} condition={dialogCondition} />
    </div>
  );
};
