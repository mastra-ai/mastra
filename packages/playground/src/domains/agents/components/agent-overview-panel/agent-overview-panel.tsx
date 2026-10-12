import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { ArrowUpRight, X } from 'lucide-react';
import { useId } from 'react';
import { AgentOverviewSections } from './agent-overview-sections';
import { cn } from '@/lib/utils';

export interface AgentOverviewPanelProps {
  agentId: string;
  open: boolean;
  onClose: () => void;
}

/** Docked beside the conversation, which makes room for it on wide canvases; stays mounted while closed. */
export function AgentOverviewPanel({ agentId, open, onClose }: AgentOverviewPanelProps) {
  const titleId = useId();
  const { Link } = useLinkComponent();

  return (
    <aside
      data-testid="agent-overview-panel"
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
      }}
      className={cn(
        'absolute inset-y-3 right-3 z-20 flex w-[min(25rem,calc(100%-1.5rem))] min-w-0 flex-col overflow-hidden rounded-xl',
        overlaySurfaceStyle,
        'origin-top-right transition-[scale,opacity] duration-300 ease-out-custom motion-reduce:transition-none',
        open ? 'scale-100 opacity-100' : 'pointer-events-none scale-98 opacity-0',
      )}
    >
      <div className="flex h-10 min-h-10 shrink-0 items-center justify-between gap-2 border-b border-border pr-2 pl-4">
        <Txt id={titleId} as="h2" variant="subheading" tone="ink">
          Config
        </Txt>
        <Button variant="ghost" size="icon-sm" aria-label="Close Config" onClick={onClose}>
          <X />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1" mask={{ top: false }}>
        <ScrollAreaViewport className="h-full">
          <AgentOverviewSections agentId={agentId} />
        </ScrollAreaViewport>
      </ScrollArea>
      <div className="shrink-0 border-t border-border p-3">
        <Button
          className="w-full"
          render={<Link href={`/agents/${encodeURIComponent(agentId)}/overview`} />}
          onClick={onClose}
        >
          Open overview
          <ArrowUpRight />
        </Button>
      </div>
    </aside>
  );
}
