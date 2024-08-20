import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';

interface ExecuteActionProps {
  onRunAction: () => void;
  className?: string;
}

const blockStyles = {
  default: 'border-[0.5px] border-solid rounded-md relative border-border',
  states: 'hover:border-accent focus:border-accent',
  header: 'p-2 text-[13px] flex gap-[7px] items-center',
};

export function ExecuteAction({ onRunAction, className }: ExecuteActionProps) {
  return (
    <button
      type="button"
      onClick={onRunAction}
      className={cn(
        blockStyles.default,
        'bg-transparent flex w-full min-w-[274px] gap-[10px] !border-dashed p-[10px]',
        className,
      )}
      title="New action"
    >
      <div className={cn('flex gap-[6px] rounded-sm bg-[#2C2C2C] p-2')}>
        <Icon name="enrich" />
        <Text size="xs" weight="medium">
          Run action
        </Text>
      </div>
      <Text className="max-w-[120px] text-left text-[10px]">Execute an action as an admin</Text>
    </button>
  );
}

export default ExecuteAction;
