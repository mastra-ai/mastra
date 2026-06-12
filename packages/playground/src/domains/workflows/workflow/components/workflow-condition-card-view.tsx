import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, Icon, Txt, cn } from '@mastra/playground-ui';
import { ChevronDown } from 'lucide-react';
import { Fragment } from 'react';

import type { WorkflowConditionCardViewProps, WorkflowConditionCodeCondition } from './types';
import { getConditionIconAndColor } from './workflow-card-badge-utils';
import { WorkflowConditionCode, WorkflowConditionDialog } from './workflow-condition-code';

const isCodeCondition = (condition: WorkflowConditionCardViewProps['conditions'][number]): condition is WorkflowConditionCodeCondition =>
  Boolean(condition.fnString);

export const WorkflowConditionCardView = ({
  type,
  conditions,
  previousDisplayStatus,
  hasPreviousStep,
  hasNextStep,
  isOpen,
  onOpenChange,
  openDialog,
  onOpenDialogChange,
  dialogCondition,
  onConditionClick,
  actionBar,
}: WorkflowConditionCardViewProps) => {
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions.length > 1) && type !== 'else';
  const { icon: IconComponent, color } = getConditionIconAndColor(type);

  return (
    <div
      data-workflow-node
      data-workflow-step-status={previousDisplayStatus ?? 'idle'}
      data-testid="workflow-condition-node"
      className={cn(
        'bg-surface3 rounded-lg w-dropdown-max-height border border-border1',
        previousDisplayStatus === 'success' && hasNextStep && 'bg-accent1Darker',
        previousDisplayStatus === 'failed' && hasNextStep && 'bg-accent2Darker',
        previousDisplayStatus === 'tripwire' && hasNextStep && 'bg-amber-950/40 border-amber-500/30',
        !hasPreviousStep && hasNextStep && 'bg-accent1Darker',
      )}
    >
      <Collapsible
        open={!isCollapsible ? true : isOpen}
        onOpenChange={(_open: boolean) => {
          if (isCollapsible) {
            onOpenChange(_open);
          }
        }}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2">
          <Badge
            icon={
              IconComponent ? <IconComponent className="text-current" {...(color ? { style: { color } } : {})} /> : null
            }
          >
            {type?.toUpperCase()}
          </Badge>
          {isCollapsible && (
            <Icon>
              <ChevronDown
                className={cn('transition-transform text-neutral3', {
                  'transform rotate-180': isOpen,
                })}
              />
            </Icon>
          )}
        </CollapsibleTrigger>

        {type === 'else' ? null : (
          <CollapsibleContent className="flex flex-col gap-2 pb-2">
            {conditions.map((condition, index) => {
              const conjType = condition.conj || type;
              const { icon: ConjIconComponent, color: conjColor } = getConditionIconAndColor(conjType);
              const conjBadge =
                index === 0 ? null : (
                  <Badge
                    icon={
                      ConjIconComponent ? (
                        <ConjIconComponent
                          className="text-current"
                          {...(conjColor ? { style: { color: conjColor } } : {})}
                        />
                      ) : null
                    }
                  >
                    {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                  </Badge>
                );

              return isCodeCondition(condition) ? (
                <WorkflowConditionCode
                  key={`${condition.fnString}-${index}`}
                  condition={condition}
                  previousDisplayStatus={previousDisplayStatus}
                  hasNextStep={hasNextStep}
                  onOpen={() => onConditionClick(condition)}
                />
              ) : (
                <Fragment key={`${condition.ref?.path}-${index}`}>
                  {condition.ref?.step ? (
                    <div className="flex items-center gap-1">
                      {conjBadge}
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
      {actionBar}
    </div>
  );
};
