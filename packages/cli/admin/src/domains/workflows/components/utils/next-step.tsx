import type { WorkflowAction } from '@mastra/core';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { useWorkflowContext } from '../../context/workflow-context';

import AddNextStep from './add-next-step';
import NextStepSelector from './next-step-selector';

function NextStep({
  onAddNextStep,
  actionId,
  conditionActionId,
  isTrigger,
  isCondition,
  className,
}: {
  onAddNextStep: () => void;
  actionId?: string;
  conditionActionId?: string;
  isTrigger?: boolean;
  isCondition?: boolean;
  className?: string;
}) {
  const { actions, setSelectedBlock } = useWorkflowContext();
  const action = actions[actionId || ''];
  const subActions = (action as WorkflowAction)?.subActions || [];
  const rootAction = Object.values(actions).find(a => !a.parentActionId);

  const _subActions = isCondition ? subActions?.filter(sub => sub.id === conditionActionId) : subActions;

  if (!isTrigger && _subActions.length === 0) {
    return (
      <div className={cn(`flex flex-col gap-[0.62rem]`, className)}>
        <div>
          <Text weight="medium" size={'xs'} className="text-mastra-el-2">
            Next step
          </Text>
        </div>

        <div>
          <AddNextStep onAddNextStep={onAddNextStep} />
        </div>
      </div>
    );
  }

  if (isTrigger && !rootAction) {
    return (
      <div className={cn(`flex flex-col gap-[0.62rem]`, className)}>
        <div>
          <Text weight="medium" className="text-mastra-el-2" size={'xs'}>
            Next step
          </Text>
        </div>

        <div>
          <AddNextStep onAddNextStep={onAddNextStep} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(`flex flex-col gap-[0.62rem]`, className)}>
      <div>
        <Text weight="medium" className="text-mastra-el-2" size={'xs'}>
          Next step
        </Text>
      </div>

      <div>
        {!isTrigger ? (
          _subActions.map(subAction => (
            <NextStepSelector
              key={subAction.id}
              action={subAction}
              onSelectActionEvent={() => {
                setSelectedBlock({ type: 'action', block: subAction });
              }}
            />
          ))
        ) : (
          <NextStepSelector
            key={rootAction?.id}
            action={rootAction!}
            onSelectActionEvent={() => {
              setSelectedBlock({ type: 'action', block: rootAction as any });
            }}
          />
        )}
      </div>
    </div>
  );
}

export default NextStep;
