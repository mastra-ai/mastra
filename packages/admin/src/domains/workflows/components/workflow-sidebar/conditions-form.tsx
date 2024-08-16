'use client';

import { createId } from '@paralleldrive/cuid2';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Text } from '@/components/ui/text';

import { Icon } from '@/app/components/icon';

import { RefinedIntegrationActionLogic } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { AutomationAction, AutomationLogicConditionGroup } from '../../types';
import NextStep from '../utils/next-step';
import BlockHeader from '../utils/render-header';

import { ConditionBox } from './condition-box';

interface ConditionsFormProps {
  actionId: string;
  block: RefinedIntegrationActionLogic;
}

function ConditionsForm({ actionId, block }: ConditionsFormProps) {
  const { actions, addNewBlankAction } = useWorkflowContext();
  const action = actions[actionId] as AutomationAction;
  if (!action) {
    return null;
  }

  const { condition } = action;
  const conditions = Array.isArray(condition) ? condition : [];
  const defaultCondition = conditions?.find(({ isDefault }) => isDefault);
  const customConditions = conditions?.filter(({ isDefault }) => !isDefault);
  const newestCondition = {
    id: createId(),
    field: '',
    operator: '',
    automationBlockId: '',
    actionId: '',
  } as AutomationLogicConditionGroup;

  const handleAddNewAction = (conditionId: string) => {
    const id = createId();

    addNewBlankAction({
      newAction: {
        id,
        type: '',
        parentActionId: actionId,
      },
      isParentACondition: true,
      conditionId,
    });

    //write to temp file
  };
  return (
    <ScrollArea className="h-full" viewportClassName="kepler-workflows-scroll-area">
      <div className="flex h-full flex-col pb-5">
        <BlockHeader
          title={block.label}
          icon={block.icon ?? { alt: 'system', icon: 'dashboard' }}
          category={'action'}
          isCondition
        />

        <section className="flex flex-col gap-[0.62rem] p-[0.62rem]">
          {customConditions.map((condition, index) => (
            <ConditionBox //this renders the action condition box
              key={condition.id}
              condition={condition}
              index={index}
              action={action}
              lastCustomConditionIndex={customConditions.length - 1}
              isInConditionForm
            />
          ))}

          <ConditionBox
            condition={newestCondition}
            index={customConditions.length}
            action={action}
            isInConditionForm
            isNew
          />

          {/**default condition */}
          {defaultCondition ? (
            <div className="bg-kp-bg-3 divide-kp-border-2 border-kp-border-2 flex flex-col divide-y-[0.5px] rounded-[0.3125rem] border-[0.5px]">
              <div className="gap-xs flex items-center p-[0.62rem]">
                <Text
                  size="xs"
                  weight={'medium'}
                  className="bg-kp-bg-9 border-kp-border-2 gap-xs flex w-fit items-center rounded-[0.23rem] border-[0.4px] px-[0.38rem] py-[0.35rem]"
                >
                  <Icon name="rule" className="text-kp-el-3 h-[0.9rem] w-[0.9rem]" />
                  Default Path
                </Text>

                <Icon name="chevron-down" className="text-kp-el-2 h-[0.8rem] w-[0.8rem] -rotate-90" />
              </div>
              <div className="p-[0.62rem] pb-[0.88rem]">
                <NextStep
                  actionId={action.id}
                  conditionActionId={defaultCondition.actionId}
                  isCondition
                  onAddNextStep={() => {
                    handleAddNewAction(defaultCondition.id!);
                  }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </ScrollArea>
  );
}

export default ConditionsForm;
