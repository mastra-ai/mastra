import type { UpdateTrigger, RefinedIntegrationEvent } from '@kepler/core';
import { createId } from '@paralleldrive/cuid2';

import { Button } from '@/components/ui/button';

import { Icon } from '@/app/components/icon';

interface TriggerEventSelectorProps {
  type: string;
  label: RefinedIntegrationEvent['label'];
  icon: string;
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
    <Button
      onClick={handleSelectTriggerEvent}
      variant="ghost"
      className="bg-kp-bg-6 border-kp-border-1 h-9 justify-start gap-3 border-[0.5px] py-0 pl-0 pr-3 text-[#a9a9a9] opacity-70 transition-colors hover:opacity-100 w-full"
    >
      <div className="border-kp-border-1 flex h-full w-9 items-center justify-center border-r-[0.3px]">
        {/* <FrameworkIcon icon={""} className="text-base text-current" /> */}
      </div>
      <span className="text-kp-el-6 text-xs font-[500]">{label}</span>
      {isSelected ? <Icon name="check-in-circle" className="text-kp-el-accent ml-auto text-base" /> : null}
    </Button>
  );
}
