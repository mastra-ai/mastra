import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { useState } from 'react';
import { AgentOverviewPanel } from './agent-overview-panel/agent-overview-panel';
import { OverviewPanelShortcuts, OVERVIEW_PANEL_SHORTCUT } from './overview-panel-shortcuts';

export function AgentConfigToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <>
      <OverviewPanelShortcuts onToggle={onToggle} />
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Config"
        aria-pressed={open}
        tooltip={
          <span className="inline-flex items-center gap-1.5">
            Config
            <Kbd size="xs">{OVERVIEW_PANEL_SHORTCUT}</Kbd>
          </span>
        }
        data-testid="agent-overview-panel-toggle"
        onClick={onToggle}
      >
        <PanelEdgeIcon side="right" />
      </Button>
    </>
  );
}

/** Mounts on first open, then stays mounted so closing can animate and reopening keeps its state. */
export function AgentConfigPanel({ agentId, open, onClose }: { agentId: string; open: boolean; onClose: () => void }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <ActivatedSkillsProvider key={agentId}>
      <AgentOverviewPanel agentId={agentId} open={open} onClose={onClose} />
    </ActivatedSkillsProvider>
  );
}
