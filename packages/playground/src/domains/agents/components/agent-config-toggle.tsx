import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';

import { OVERVIEW_PANEL_SHORTCUT } from './overview-panel-shortcuts';
import { useRouteSidePanel } from '@/lib/route-side-panel';

export function AgentConfigToggle() {
  const { isCollapsed, toggle } = useRouteSidePanel();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label="Config"
      aria-pressed={!isCollapsed}
      className="max-lg:hidden"
      tooltip={
        <span className="inline-flex items-center gap-1.5">
          {isCollapsed ? 'Show Config panel' : 'Hide Config panel'}
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
