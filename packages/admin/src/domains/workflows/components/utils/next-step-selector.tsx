import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';
import { WorkflowContextAction } from '../../types';

import { FrameworkIcon } from './action-selector';
import AddNextStep from './add-next-step';

interface NextStepSelectorProps {
  action: WorkflowContextAction;
  onSelectActionEvent: () => void;
}

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-border',
  states: 'hover:border-accent focus:border-accent',
  header: 'p-2 text-[13px] flex gap-[7px] items-center',
};

export function NextStepSelector({ action, onSelectActionEvent }: NextStepSelectorProps) {
  const { frameworkActions } = useWorkflowContext();
  const { id, type } = action;
  const frameworkAction =
    frameworkActions.find(action => action.type === type) || systemLogics.find(action => action.type === type);

  const handleSelectAction = () => {
    onSelectActionEvent();
  };

  if (!id) return null;

  if (!frameworkAction) {
    return <AddNextStep onAddNextStep={handleSelectAction} />;
  }

  return (
    <button onClick={handleSelectAction} className={cn(blockStyles.default, 'bg-transparent w-full')}>
      <div className={cn(blockStyles.header, 'text-[13px]')}>
        <span className={cn('border-border bg-transparent rounded-sm border-[0.4px] border-solid p-2', {})}>
          <FrameworkIcon icon={frameworkAction.icon} className="text-current" />
        </span>
        <Text size="xs" weight="medium">
          {frameworkAction.label}
        </Text>
      </div>
    </button>
  );
}

export default NextStepSelector;
