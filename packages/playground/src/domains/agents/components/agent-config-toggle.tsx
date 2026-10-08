import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Popover, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { useState } from 'react';
import { AgentOverviewPanel } from './agent-overview-panel/agent-overview-panel';
import { OverviewPanelShortcuts, OVERVIEW_PANEL_SHORTCUT } from './overview-panel-shortcuts';

export function AgentConfigToggle({ agentId, container }: { agentId: string; container: HTMLElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <OverviewPanelShortcuts onToggle={() => setOpen(value => !value)} />
      <PopoverTrigger
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Config"
        tooltip={
          <span className="inline-flex items-center gap-1.5">
            Config
            <Kbd size="xs">{OVERVIEW_PANEL_SHORTCUT}</Kbd>
          </span>
        }
        data-testid="agent-overview-panel-toggle"
      >
        <PanelEdgeIcon side="right" />
      </PopoverTrigger>
      <ActivatedSkillsProvider key={agentId}>
        <AgentOverviewPanel agentId={agentId} container={container} onClose={() => setOpen(false)} />
      </ActivatedSkillsProvider>
    </Popover>
  );
}
