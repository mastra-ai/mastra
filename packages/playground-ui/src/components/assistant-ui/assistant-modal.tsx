'use client';

import { AssistantModalPrimitive } from '@assistant-ui/react';
import { BotIcon, ChevronDownIcon } from 'lucide-react';
import { type FC, forwardRef } from 'react';

import { Thread } from '@/components/assistant-ui/thread';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';

export const AssistantModal: FC = () => {
  return (
    <AssistantModalPrimitive.Root>
      <AssistantModalPrimitive.Anchor className="fixed bottom-4 right-4 size-11">
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton />
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={16}
        className="bg-popover text-popover-foreground z-50 h-[500px] w-[400px] overflow-clip rounded-xl border p-0 shadow-md outline-none [&>.aui-thread-root]:bg-inherit data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out data-[state=open]:zoom-in data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:slide-out-to-right-1/2"
      >
        <Thread />
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
};

type AssistantModalButtonProps = { 'data-state'?: 'open' | 'closed' };

const AssistantModalButton = forwardRef<HTMLButtonElement, AssistantModalButtonProps>(
  ({ 'data-state': state, ...rest }, ref) => {
    const tooltip = state === 'open' ? 'Close Assistant' : 'Open Assistant';

    return (
      <TooltipIconButton
        variant="default"
        tooltip={tooltip}
        side="left"
        {...rest}
        className="size-full rounded-full shadow transition-transform hover:scale-110 active:scale-90"
        ref={ref}
      >
        <BotIcon
          data-state={state}
          className="absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0"
        />

        <ChevronDownIcon
          data-state={state}
          className="absolute size-6 transition-all data-[state=closed]:-rotate-90 data-[state=open]:rotate-0 data-[state=closed]:scale-0 data-[state=open]:scale-100"
        />
        <span className="sr-only">{tooltip}</span>
      </TooltipIconButton>
    );
  },
);

AssistantModalButton.displayName = 'AssistantModalButton';
