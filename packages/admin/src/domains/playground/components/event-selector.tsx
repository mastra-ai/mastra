import { frameWorkIcon, RefinedIntegrationEvent } from '@kpl/core';

import Image from 'next/image';

import { iconArr } from '@/components/ui/svg/iconArr';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

import { useEventPlaygroundContext } from '../providers/event-playground-provider';

interface EventSelectorProps {
  type: string;
  isSelected?: boolean;
}

export function EventSelector({ type, isSelected }: EventSelectorProps) {
  const { frameworkEvents, setSelectedEvent } = useEventPlaygroundContext();
  const frameworkEvent = frameworkEvents.find(event => event?.key === type);

  const handleSelectEvent = (event: RefinedIntegrationEvent) => {
    setSelectedEvent(event);
  };

  if (!frameworkEvent) return null;

  return (
    <button
      onClick={() => handleSelectEvent(frameworkEvent)}
      className={cn(
        'border-border bg-kp-bg-6 relative w-full rounded-sm border-[0.5px] border-solid opacity-80 hover:opacity-100',
      )}
    >
      <div className={cn('flex items-center gap-[7px] p-[10px]')}>
        {/* <FrameworkIcon icon={""} className="h-4 w-4 text-current" /> */}
        <Text className="text-kp-el-6" size="xs" weight="medium">
          {frameworkEvent.label || frameworkEvent?.key}
        </Text>
        {isSelected ? <Icon name="check-in-circle" className="text-accent-1 ml-auto text-base" /> : null}
      </div>
    </button>
  );
}

export default EventSelector;

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
