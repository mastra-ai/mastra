import { Button, Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui';
import { Settings2 } from 'lucide-react';

import { AgentRunOptionsContent } from './agent-run-options';

interface ComposerRunOptionsProps {
  requestContextSchema?: string;
}

const RUN_OPTIONS_COLLISION_AVOIDANCE = {
  side: 'flip',
  align: 'shift',
  fallbackAxisSide: 'end',
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
          <Settings2 className="h-5 w-5 text-neutral3 hover:text-neutral6" />
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
