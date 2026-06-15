import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@mastra/playground-ui';
import { Activity } from 'lucide-react';

import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

/**
 * Top-bar popover for editing the tracing options applied to each run.
 * Requires TracingSettingsProvider.
 */
export function AgentTracingControls() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Tracing Options" data-testid="agent-tracing-controls-trigger">
          <Activity />
          Tracing
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[480px] p-0">
        <ScrollArea className="max-h-[500px]">
          <TracingRunOptions />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
