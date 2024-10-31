import { createId } from '@paralleldrive/cuid2';

import { Text } from '@/components/ui/text';

import { useWorkflowContext } from '../../context/workflow-context';

import NextStep from './next-step';

interface ConditionNextStepProps {
  actionId: string;
}

function ConditionNextStep({ actionId }: ConditionNextStepProps) {
  const { actions, addNewBlankAction } = useWorkflowContext();
  const action = actions[actionId || ''];
  const { condition } = action;
  const conditions = Array.isArray(condition) ? condition : [];

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
  };

  return (
    <div className="mt-auto space-y-5">
      {conditions
        ?.filter(({ isDefault, blockId }) => !isDefault && blockId)
        ?.map((condition, index) => (
          <div key={condition.id} className="space-y-2 px-6">
            <Text size="xs">{condition.isDefault ? 'Default' : `Condition ${index + 1}`}</Text>
            <NextStep
              actionId={action.id}
              conditionActionId={condition.actionId}
              isCondition
              onAddNextStep={() => {
                handleAddNewAction(condition.id!);
              }}
            />
          </div>
        ))}
    </div>
  );
}

export default ConditionNextStep;
