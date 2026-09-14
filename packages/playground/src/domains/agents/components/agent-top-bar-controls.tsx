import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';

import { AgentRunOptionsContent } from './agent-run-options';

export const RUN_OPTIONS_SHORTCUT = 'u';

interface AgentTopBarRunOptionsProps {
  requestContextSchema?: string;
}

export function AgentTopBarRunOptions({ requestContextSchema }: AgentTopBarRunOptionsProps) {
  const [open, setOpen] = useState(false);

  useKeydown({ [RUN_OPTIONS_SHORTCUT]: () => setOpen(prev => !prev) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          tooltip={
            <span className="inline-flex items-center gap-1.5">
              Run options
              <Kbd size="xs">U</Kbd>
            </span>
          }
          data-testid="agent-top-bar-run-options-trigger"
          icon={<Settings2 />}
        >
          Run options
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(760px,calc(100vw-2rem))] p-0">
        <AgentRunOptionsContent requestContextSchema={requestContextSchema} />
      </PopoverContent>
    </Popover>
  );
}

export const AgentTopBarControls = AgentTopBarRunOptions;
