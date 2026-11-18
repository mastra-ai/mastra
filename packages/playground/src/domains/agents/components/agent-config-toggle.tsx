import { Button } from '@mastra/playground-ui/components/Button';
import { DrawerTrigger } from '@mastra/playground-ui/components/Drawer';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';

import { OVERVIEW_PANEL_SHORTCUT } from './overview-panel-shortcuts';
import { useRouteSidePanel } from '@/lib/route-side-panel';

export function AgentConfigToggle() {
  const isMobile = useIsMobile();
  const { isCollapsed, toggle } = useRouteSidePanel();

  // Below the breakpoint the Config panel is the agent page's own drawer (see `AgentLayout`).
  if (isMobile) {
    return (
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Config"
          tooltip="Show config panel"
          data-testid="agent-overview-panel-toggle"
        >
          <PanelEdgeIcon side="right" />
        </Button>
      </DrawerTrigger>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label="Config"
      aria-pressed={!isCollapsed}
      tooltip={
        <span className="inline-flex items-center gap-1.5">
          {isCollapsed ? 'Show config panel' : 'Hide config panel'}
          <Kbd size="xs">{OVERVIEW_PANEL_SHORTCUT}</Kbd>
        </span>
      }
      data-testid="agent-overview-panel-toggle"
      onClick={toggle}
    >
      <PanelEdgeIcon side="right" />
    </Button>
  );
}
