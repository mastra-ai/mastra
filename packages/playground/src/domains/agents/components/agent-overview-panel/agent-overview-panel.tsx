import { Button } from '@mastra/playground-ui/components/Button';
import { PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { AgentOverviewSections } from './agent-overview-sections';

export interface AgentOverviewPanelProps {
  agentId: string;
  container: HTMLElement;
  onClose: () => void;
}

export function AgentOverviewPanel({ agentId, container, onClose }: AgentOverviewPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { Link } = useLinkComponent();

  return (
    <PopoverContent
      data-testid="agent-overview-panel"
      aria-labelledby={titleId}
      container={container}
      anchor={container}
      align="end"
      alignOffset={8}
      side="bottom"
      sideOffset={({ anchor }) => -anchor.height + 8}
      collisionBoundary={container}
      collisionPadding={8}
      collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }}
      initialFocus={closeRef}
      className="grid h-[min(48rem,var(--available-height))] max-h-[calc(100dvh-5rem)] w-[min(25rem,var(--available-width))] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-px"
    >
      <div className="flex h-10 min-h-10 items-center justify-between gap-2 border-b border-border pr-2 pl-4">
        <Txt id={titleId} as="h2" variant="subheading" tone="ink">
          Config
        </Txt>
        <Button ref={closeRef} variant="ghost" size="icon-sm" aria-label="Close Config" onClick={onClose}>
          <X />
        </Button>
      </div>

      <ScrollArea className="min-h-0" mask={{ top: false }}>
        <ScrollAreaViewport className="h-full">
          <AgentOverviewSections agentId={agentId} />
        </ScrollAreaViewport>
      </ScrollArea>
      <div className="border-t border-border p-3">
        <Button
          className="w-full"
          render={<Link href={`/agents/${encodeURIComponent(agentId)}/configuration`} />}
          onClick={onClose}
        >
          Advanced config
          <ArrowUpRight />
        </Button>
      </div>
    </PopoverContent>
  );
}
