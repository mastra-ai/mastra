import { createId } from '@paralleldrive/cuid2';

import { Icon } from '@/components/icon';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { useWorkflowContext } from '../../context/workflow-context';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-mastra-border-1',
  states: 'hover:border-mastra-border-5 focus:border-mastra-border-5',
  header: 'p-[10px] text-[13px] flex gap-[7px] items-center',
  details: 'bg-neutral-800 rounded-b-md p-[10px] text-[10px] text-left text-neutral-300',
};

export function NewWorkflowActionBlock() {
  const { addNewBlankAction, selectedBlock } = useWorkflowContext();

  const handleNewBlankAction = () => {
    const id = createId();
    addNewBlankAction({
      newAction: {
        id,
        type: '',
      },
      isParentATrigger: true,
    });
  };

  return (
    <>
      <div
        role="presentation"
        className={cn('from-mastra-el-1 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-b')}
      />
      <button
        onClick={handleNewBlankAction}
        className={cn(
          blockStyles.default,
          blockStyles.states,
          'bg-mastra-bg-3 flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
          {
            'border-mastra-border-5': selectedBlock?.type === 'action',
          },
        )}
        title="New API"
      >
        <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
          <Icon name="enrich" className="text-mastra-el-4" />
          <Text size="xs" className="text-mastra-el-4" weight="medium">
            API
          </Text>
        </div>
        <Text className="text-mastra-el-3 max-w-[120px] text-left text-[10px]">
          Select API to continue your workflow
        </Text>
      </button>
    </>
  );
}
