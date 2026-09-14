import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';

import { AgentRunOptionsContent } from './agent-run-options';
import { RUN_OPTIONS_SHORTCUT } from './agent-top-bar-controls';

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
  const [open, setOpen] = useState(false);

  useKeydown({ [RUN_OPTIONS_SHORTCUT]: () => setOpen(prev => !prev) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="icon-md"
          type="button"
          tooltip={
            <span className="inline-flex items-center gap-1.5">
              Run options
              <Kbd size="xs">U</Kbd>
            </span>
          }
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
