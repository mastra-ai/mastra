import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Text } from '@/components/ui/text';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import last from 'lodash/last';

import { useWorkflowContext } from '../../context/workflow-context';
import { AutomationAction, AutomationCondition, AutomationLogicConditionGroup } from '../../types';
import { pathAlphabet, isConditionValid } from '../../utils';
import { DeleteWorkflowConditionPathDropdownButton } from '../utils/delete-workflow-condition-path-dropdown-button';

import { WorkflowGraphAddBlock } from './workflow-graph-add-block';

export const blockStyles = {
  default: 'border-[0.5px] p-[0.38rem] flex gap-1 border-solid rounded-md relative border-border',
  states: 'hover:border-accent focus:border-accent',
  header: ' text-[13px] flex gap-3 items-center',
  details: 'bg-neutral-800 rounded-b-md text-[10px] text-left text-neutral-300',
};

export function ConditionsBlock({
  conditions,
  parentActionId,
  conditionGroup,
  index,
  noOfActions,
}: {
  conditions: AutomationCondition[];
  parentActionId: string;
  conditionGroup: AutomationLogicConditionGroup;
  index: number;
  noOfActions: number;
}) {
  const { selectedBlock, setSelectedBlock, actions } = useWorkflowContext();

  const path = index;

  const isFirstItem = noOfActions > 1 && index === 0;
  const isLastItem = noOfActions > 1 && index === noOfActions - 1;

  const parentAction = actions[parentActionId];

  return (
    <>
      {isFirstItem || isLastItem ? (
        <div
          role="presentation"
          className={cn('border-accent relative -mt-3 mb-[36px] h-[8px] w-1/2 border-t bg-transparent', {
            'left-1/4 rounded-[8px_0_0_0] border-l': isFirstItem,
            'right-1/4 rounded-[0_8px_0_0] border-r': isLastItem,
          })}
        >
          <div
            role="presentation"
            className={cn('from-accent to-transparent absolute top-[7px] h-[36px] w-[1px] bg-gradient-to-b', {
              'right-full': isFirstItem,
              'left-full': isLastItem,
            })}
          />
        </div>
      ) : (
        <>
          <div
            role="presentation"
            className={cn('border-accent relative -mt-3 h-[1px] border-t bg-transparent', {
              'w-full': noOfActions > 1,
            })}
          />
          <div
            role="presentation"
            className={cn('from-accent to-transparent relative h-[43px] w-[1px] bg-gradient-to-b', {})}
          />
        </>
      )}
      <ContextMenu>
        <ContextMenuTrigger aria-label="context-menu" className="relative">
          <button
            className={cn(
              blockStyles.default,
              blockStyles.states,
              blockStyles.details,
              'flex min-w-[154.23px] max-w-[274px] flex-wrap',
              selectedBlock?.block?.id === conditionGroup?.id ? 'border-accent' : '',
              isConditionValid(conditionGroup) || conditionGroup.isDefault ? 'items-stretch' : 'items-center',
            )}
            onClick={() => {
              if (conditionGroup) {
                setSelectedBlock({
                  type: 'path',
                  block: conditionGroup,
                });
              }
            }}
          >
            {conditionGroup?.isDefault ? (
              <>
                <div className="text-el-kp-3 flex items-center gap-[0.63rem]">
                  <div className="bg-transparent border-border flex h-fit items-center justify-center rounded-[0.2rem] border-[0.4px] px-[0.34rem] py-[0.32rem] align-middle">
                    <Icon name="rule" />
                  </div>
                  <Text size={'xs'}>Default path</Text>
                </div>
              </>
            ) : (
              <>
                <Text
                  size={'xs'}
                  weight={'medium'}
                  className="bg-transparent border-border flex h-fit items-center justify-center rounded-[0.2rem] border-[0.4px] px-[0.46rem] py-[0.32rem] align-middle"
                >
                  {pathAlphabet[path]}
                </Text>
                {/* this displays the condition */}

                {isConditionValid(conditionGroup) ? (
                  conditions.map((condition, index) => {
                    return (
                      <>
                        {condition.field ? (
                          <div key={index} className="flex items-stretch gap-1">
                            {condition.conj && condition.field ? (
                              <Text
                                size={'xs'}
                                weight="medium"
                                className="bg-transparent my-auto block rounded-[0.125rem] px-2 py-1 text-[10px]"
                              >
                                {condition.conj.toLocaleUpperCase()}
                              </Text>
                            ) : null}

                            {condition.field ? (
                              <div
                                className={cn(
                                  'bg-transparent border-border flex w-full items-center rounded-[0.25rem] border-[0.5px]',
                                )}
                              >
                                {condition.field ? (
                                  <Text
                                    size={'xs'}
                                    className="border-r-border text-kp-el-3 border-r-[0.5px] px-[0.38rem] py-[0.19rem]"
                                  >
                                    {lodashTitleCase(last(condition.field?.split('.')) || '')}
                                  </Text>
                                ) : null}

                                {condition.operator ? (
                                  <Text
                                    size={'xs'}
                                    className="border-r-border border-r-[0.5px] px-[0.38rem] py-[0.19rem] lowercase"
                                  >
                                    {condition.operator}
                                  </Text>
                                ) : null}

                                {condition.value ? (
                                  <Text size={'xs'} className="px-[0.38rem] py-[0.19rem]">
                                    {condition.value as any}
                                  </Text>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    );
                  })
                ) : (
                  <Text className="flex gap-1 px-[0.38rem]">
                    <Icon name="rule" />
                    <Text size={'xs'}>Path condition</Text>
                  </Text>
                )}
              </>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="rounded-[8px] border-0 bg-[#737373]/5 shadow-md ring-1 ring-neutral-700 backdrop-blur-xl">
          <DeleteWorkflowConditionPathDropdownButton
            conditionGroup={conditionGroup}
            parentAction={parentAction as AutomationAction}
          />
        </ContextMenuContent>
      </ContextMenu>

      <div
        role="presentation"
        className={cn('from-accent to-transparent relative h-[30px] w-[1px] bg-gradient-to-t')}
      />
      <WorkflowGraphAddBlock
        parentActionId={parentActionId}
        isParentACondition={!!conditionGroup?.id}
        conditionId={conditionGroup?.id}
      />
    </>
  );
}
