import type { UpdateTrigger, RefinedIntegrationEvent, frameWorkIcon } from '@mastra/core';
import { createId } from '@paralleldrive/cuid2';

import { Icon } from '@/components/icon';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

import { FrameworkIcon } from './action-selector';

interface TriggerEventSelectorProps {
  type: string;
  label: RefinedIntegrationEvent['label'];
  icon: frameWorkIcon;
  isSelected: boolean;
  onSelectTriggerEvent: (trigger: UpdateTrigger) => void;
}

export function TriggerEventSelector({
  type,
  label,
  icon,
  onSelectTriggerEvent,
  isSelected,
}: TriggerEventSelectorProps) {
  const handleSelectTriggerEvent = () => {
    const id = createId();
    onSelectTriggerEvent({ id, type, ...(isSelected ? {} : { condition: undefined, payload: { value: undefined } }) });
  };
  return (
    <button
      onClick={handleSelectTriggerEvent}
      className={cn(
        'border-mastra-border-1 bg-mastra-bg-6 relative w-full rounded-sm border-[0.5px] border-solid opacity-80 hover:opacity-100',
      )}
    >
      <div className={cn('flex items-center gap-[7px] p-[10px]')}>
        <FrameworkIcon icon={icon} className="h-4 w-4 text-current" />
        <Text className="text-mastra-el-6 capitalize" size="xs" weight="medium">
          {label}
        </Text>
        {isSelected ? <Icon name="check-in-circle" className="text-mastra-el-accent ml-auto text-base" /> : null}
      </div>
    </button>
  );
}
