import { createId } from '@paralleldrive/cuid2';

import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

import { useWorkflowContext } from '../../context/workflow-context';

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-border',
  states: 'hover:border-accent focus:border-accent',
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
        className={cn('from-accent to-transparent relative h-[30px] w-[1px] bg-gradient-to-b')}
      />
      <button
        onClick={handleNewBlankAction}
        className={cn(
          blockStyles.default,
          blockStyles.states,
          'bg-background flex min-w-[274px] gap-[10px] !border-dashed p-[10px]',
          {
            'border-accent': selectedBlock?.type === 'action',
          },
        )}
        title="New action"
      >
        <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
          <Icon name="enrich" />
          <Text size="xs" weight="medium">
            Action
          </Text>
        </div>
        <Text className="max-w-[120px] text-left text-[10px]">Select event to continue your workflow</Text>
      </button>
    </>
  );
}
