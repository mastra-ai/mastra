import type { WorkflowContextAction } from '@mastra/core';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';

import { FrameworkIcon } from './action-selector';
import AddNextStep from './add-next-step';

interface NextStepSelectorProps {
  action: WorkflowContextAction;
  onSelectActionEvent: () => void;
}

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-mastra-border-1',
  states: 'hover:border-mastra-border-5 focus:border-mastra-border-5',
  header: 'p-2 text-[13px] flex gap-[7px] items-center',
};

export function NextStepSelector({ action, onSelectActionEvent }: NextStepSelectorProps) {
  const { frameworkApis } = useWorkflowContext();
  const { id, type } = action;
  const frameworkApi =
    frameworkApis.find(action => action.type === type) || systemLogics.find(action => action.type === type);

  const handleSelectAction = () => {
    onSelectActionEvent();
  };

  if (!id) return null;

  if (!frameworkApi) {
    return <AddNextStep onAddNextStep={handleSelectAction} />;
  }

  return (
    <button onClick={handleSelectAction} className={cn(blockStyles.default, 'bg-transparent w-full')}>
      <div className={cn(blockStyles.header, 'text-[13px]')}>
        <div className={cn('flex items-center gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
          <FrameworkIcon icon={frameworkApi.icon} className="text-current" />
          <Text className="text-mastra-el-6 capitalize" size="xs" weight="medium">
            {frameworkApi.label}
          </Text>
        </div>
      </div>
    </button>
  );
}

export default NextStepSelector;
