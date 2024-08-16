import { createId } from '@paralleldrive/cuid2';
import { ReactNode, useState } from 'react';

import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import { useWorkflowContext } from '../../context/workflow-context';
import { AutomationAction, AutomationConditionConj, AutomationLogicConditionGroup } from '../../types';
import { isConditionValid, pathAlphabet } from '../../utils';
import NextStep from '../utils/next-step';

import { ConditionConjDropdown } from './condition-conj-dropdown';
import { ConditionFilterBar } from './condition-filter-bar';
import { WorkflowPathDropdown } from './workflow-path-dropdown';

interface ConditionBoxProps {
  condition: AutomationLogicConditionGroup;
  action: AutomationAction;
  index: number;
  lastCustomConditionIndex?: number;
  children?: ReactNode;
  isNew?: boolean;
  isInConditionForm?: boolean;
}

export function ConditionBox({
  condition,
  action,
  index,
  lastCustomConditionIndex,
  isNew,
  isInConditionForm,
}: ConditionBoxProps) {
  const { updateLogicActionCondition, addNewBlankAction, blueprintInfo, attemptedPublish } = useWorkflowContext();
  const { and, or } = condition;
  const extras = and || or;

  const defaultConj = and ? 'and' : 'or';
  const [conjState, setConjState] = useState<AutomationConditionConj>(defaultConj || 'and');

  const handleAddConjCondition = () => {
    const updatedCondition = {
      ...condition,
      [conjState]: [
        ...(extras || []),
        { field: '', operator: '', automationBlockId: '', actionId: '', isDefault: false, id: createId() },
      ],
    };
    updateLogicActionCondition({ actionId: action.id, condition: updatedCondition });
    //write to temp file
  };

  const handleUpdateConjCondition = (newConj: AutomationConditionConj) => {
    let updatedCondition = condition;
    delete updatedCondition[conjState];
    updatedCondition = {
      ...condition,
      [newConj]: extras,
    };
    setConjState(newConj);
    updateLogicActionCondition({ actionId: action.id, condition: updatedCondition });
    //write to temp file
  };

  const handleAddNewAction = (conditionId: string) => {
    const id = createId();

    addNewBlankAction({
      newAction: {
        id,
        type: '',
        parentActionId: action.id,
      },
      isParentACondition: true,
      conditionId,
    });

    //write to temp file
  };

  const handleAddNewCondition = () => {
    const id = createId();

    updateLogicActionCondition({
      actionId: action.id,
      condition: { id, automationBlockId: '', operator: '', field: '', actionId: '', value: '' },
      isNewCondition: true,
    });
    //write to temp file
  };

  //condition vs path
  return (
    <div
      className={cn('divide-kp-border-2 flex flex-col divide-y-[0.5px]', {
        'cursor-pointer !border-dashed': isNew,
        'border-kp-border-2 bg-kp-bg-3 rounded-[0.3125rem] border-[0.5px]': isInConditionForm,
      })}
      onClick={isNew ? handleAddNewCondition : undefined}
    >
      {isInConditionForm ? (
        <div className="gap-xs flex items-center p-[0.62rem]">
          <Text
            size="xs"
            weight={'medium'}
            className={cn(
              'bg-kp-bg-9 border-border gap-xs flex w-fit items-center rounded-[0.23rem] border-[0.4px] px-[0.38rem] py-[0.35rem]',
              isNew ? 'text-kp-el-3' : '',
            )}
          >
            <Icon name="rule" className="text-kp-el-3 h-[0.9rem] w-[0.9rem]" />
            Path {pathAlphabet[index]}
          </Text>
          {isNew ? (
            <Text className="text-kp-el-3 max-w-[120px] text-left text-[10px]">Add another path</Text>
          ) : (
            <>
              <Icon name="chevron-down" className="text-kp-el-2 h-[0.8rem] w-[0.8rem] -rotate-90" />
              <WorkflowPathDropdown parentAction={action} conditionGroup={condition} />
            </>
          )}
        </div>
      ) : null}

      {!isNew ? (
        <>
          {/*this renders the action condition filter bar*/}
          <div
            className={cn('flex flex-col gap-[0.62rem]', {
              'p-[0.62rem] pb-[0.88rem] pt-3': isInConditionForm,
              'px-5 py-6': !isInConditionForm,
            })}
          >
            <Text size={'xs'} className="text-kp-el-2">
              Condition
            </Text>
            <ConditionFilterBar
              action={action}
              condition={condition}
              isLastCondition={index === lastCustomConditionIndex}
            />

            {extras?.map((extra, index) => (
              <div key={index} className="divide-kp-border-2 w-full divide-y-[0.5px]">
                {/*this renders the condition rule dropdown which can either be AND or OR*/}
                <div className="flex gap-1">
                  <ConditionConjDropdown conj={conjState} updateConj={handleUpdateConjCondition} />
                  <ConditionFilterBar action={action} condition={extra} parentCondition={condition} conj={conjState} />
                </div>
              </div>
            ))}

            {attemptedPublish && !isConditionValid(condition) ? (
              <Text size="xs" className="text-red-500">
                Please complete the condition configuration
              </Text>
            ) : null}

            <IconButton
              icon="plus-icon"
              iconClassname="text-kp-el-3 transition-colors hover:text-kp-el-6 w-[0.9rem] h-[0.9rem]"
              className="text-kp-el-3 hover:text-kp-el-6 mt-[0.62rem] flex h-6 w-fit items-center justify-center rounded-r bg-[#2A2A2A] p-1.5 text-xs font-normal transition-colors"
              onClick={handleAddConjCondition}
              aria-label="Add new filter"
            >
              Add Condition
            </IconButton>
          </div>

          {/*this renders the next steps section */}
          <div className={cn({ 'p-[0.62rem] pb-[0.88rem]': isInConditionForm, 'px-5 py-6': !isInConditionForm })}>
            <NextStep
              actionId={action.id}
              conditionActionId={condition.actionId}
              isCondition
              onAddNextStep={() => {
                handleAddNewAction(condition.id!);
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
