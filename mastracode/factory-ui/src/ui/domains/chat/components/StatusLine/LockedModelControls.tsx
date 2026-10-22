import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { ChevronDown } from 'lucide-react';

import { SessionThinkingControl } from './SessionThinkingControl';

interface LockedModelControlsProps {
  modelId: string;
  reason: string;
}

export function LockedModelControls({ modelId, reason }: LockedModelControlsProps) {
  const label = formatModelName(modelId);
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="button"
              tabIndex={0}
              aria-disabled="true"
              aria-label={`Session model: ${label}. ${reason}`}
              className={cn(
                'inline-flex h-control-sm shrink-0 cursor-not-allowed items-center gap-1 rounded-full border border-transparent px-2.5 text-placeholder',
                focusRing,
              )}
            />
          }
        >
          <span className="max-w-48 truncate">{label}</span>
          <ChevronDown aria-hidden size={12} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64">
          {reason}
        </TooltipContent>
      </Tooltip>
      <SessionThinkingControl modelId={modelId} switchingModel={false} lockedReason={reason} />
    </ButtonsGroup>
  );
}
