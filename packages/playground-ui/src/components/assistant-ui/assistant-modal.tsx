'use client';

import { BotIcon, ChevronDownIcon } from 'lucide-react';
import { forwardRef } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';

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
