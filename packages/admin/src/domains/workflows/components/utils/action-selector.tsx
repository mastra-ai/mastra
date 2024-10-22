import { UpdateAction, frameWorkIcon } from '@mastra/core';

import { Icon } from '@/components/icon';
import { iconArr } from '@/components/ui/svg/iconArr';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';
import { IconName } from '@/types/icons';

import { systemLogics } from '../../constants';
import { useWorkflowContext } from '../../context/workflow-context';

interface ActionSelectorProps {
  type: string;
  isSelected?: boolean;
  onSelectActionEvent: (action: UpdateAction) => void;
}

export function ActionSelector({ type, onSelectActionEvent, isSelected }: ActionSelectorProps) {
  const { frameworkApis } = useWorkflowContext();
  const frameworkApi =
    frameworkApis.find(action => action.type === type) || systemLogics.find(action => action.type === type);

  const handleSelectAction = () => {
    onSelectActionEvent({ type });
  };

  if (!frameworkApi) return null;

  return (
    <button
      onClick={handleSelectAction}
      className={cn(
        'border-mastra-border-1 bg-mastra-bg-6 relative w-full rounded-sm border-[0.5px] border-solid opacity-80 hover:opacity-100',
      )}
    >
      <div className={cn('flex items-center gap-[7px] p-[10px]')}>
        <FrameworkIcon
          icon={frameworkApi.icon || { icon: 'system', alt: frameworkApi.label }}
          className="h-4 w-4 text-current"
        />
        <Text className="text-mastra-el-6 capitalize text-left" size="xs" weight="medium">
          {frameworkApi.label}
        </Text>
        {isSelected ? <Icon name="check-in-circle" className="text-mastra-el-accent ml-auto text-base" /> : null}
      </div>
    </button>
  );
}

export default ActionSelector;

export const FrameworkIcon = ({
  icon,
  className,
  imageSize = 12.5,
}: {
  icon?: frameWorkIcon;
  className?: string;
  imageSize?: number;
}) => {
  return iconArr?.includes(icon?.icon!) ? (
    <Icon
      name={icon?.icon === 'plus-icon' ? 'system' : (icon?.icon as IconName)}
      className={cn('h-5 w-5', className)}
    />
  ) : (
    <IntegrationLogo name={icon?.alt || ''} logoUrl={icon?.icon || ''} imageSize={imageSize} />
  );
};
