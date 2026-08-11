import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Settings2 } from 'lucide-react';

import { AgentRunOptionsContent } from './agent-run-options';

interface ComposerRunOptionsProps {
  requestContextSchema?: string;
}

// Only `align` deviates from base-ui's defaults (side: 'flip', fallbackAxisSide: 'end').
// 'shift' keeps the wide popup anchored to `start` and slides it into view instead of
// flipping start↔end, which would make it jump sides.
const RUN_OPTIONS_COLLISION_AVOIDANCE = {
  align: 'shift',
} as const;

/**
 * Composer popover for run-scoped controls.
 * Requires SchemaRequestContextProvider and TracingSettingsProvider.
 */
export function ComposerRunOptions({ requestContextSchema }: ComposerRunOptionsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="icon-md"
          type="button"
          tooltip="Run options"
          data-testid="composer-run-options-trigger"
        >
          <Settings2 className="text-neutral3 hover:text-neutral6 h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={RUN_OPTIONS_COLLISION_AVOIDANCE}
        className="w-[min(760px,calc(100vw-2rem))] p-0"
      >
        <AgentRunOptionsContent requestContextSchema={requestContextSchema} />
      </PopoverContent>
    </Popover>
  );
}

export const ComposerRequestContext = ComposerRunOptions;
