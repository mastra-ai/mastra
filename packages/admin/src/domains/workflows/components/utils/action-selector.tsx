import { UpdateAction, frameWorkIcon } from '@arkw/core';

import Image from 'next/image';

import { iconArr } from '@/components/ui/svg/iconArr';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';

interface ActionSelectorProps {
  type: string;
  isSelected?: boolean;
  onSelectActionEvent: (action: UpdateAction) => void;
}

export function ActionSelector({ type, onSelectActionEvent, isSelected }: ActionSelectorProps) {
  const { frameworkActions } = useWorkflowContext();
  const frameworkAction =
    frameworkActions.find(action => action.type === type) || systemLogics.find(action => action.type === type);

  const handleSelectAction = () => {
    onSelectActionEvent({ type });
  };

  if (!frameworkAction) return null;

  return (
    <button
      onClick={handleSelectAction}
      className={cn(
        'border-arkw-border-1 bg-arkw-bg-6 relative w-full rounded-sm border-[0.5px] border-solid opacity-80 hover:opacity-100',
      )}
    >
      <div className={cn('flex items-center gap-[7px] p-[10px]')}>
        <FrameworkIcon icon={frameworkAction.icon} className="h-4 w-4 text-current" />
        <Text className="text-arkw-el-6" size="xs" weight="medium">
          {frameworkAction.label}
        </Text>
        {isSelected ? <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" /> : null}
      </div>
    </button>
  );
}

export default ActionSelector;

export const FrameworkIcon = ({ icon, className }: { icon?: frameWorkIcon; className?: string }) => {
  return iconArr?.includes(icon?.icon!) ? (
    <Icon name={icon?.icon as IconName} className={cn('h-[14px] w-[14px]', className)} />
  ) : (
    <Image
      src={icon?.icon ?? ''}
      alt={icon?.alt ?? ''}
      width={14}
      height={14}
      className={cn('h-[14px] w-[14px]', className)}
    />
  );
};
