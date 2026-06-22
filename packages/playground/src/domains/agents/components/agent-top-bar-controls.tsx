import { Button, Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui';
import { Settings2 } from 'lucide-react';

import { AgentRunOptionsContent } from './agent-run-options';

interface AgentTopBarRunOptionsProps {
  requestContextSchema?: string;
}

export function AgentTopBarRunOptions({ requestContextSchema }: AgentTopBarRunOptionsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          tooltip="Run options"
          data-testid="agent-top-bar-run-options-trigger"
        >
          <Settings2 />
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
