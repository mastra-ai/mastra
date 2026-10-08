import { Button } from '@mastra/playground-ui/components/Button';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { useThreadsPanel } from '../context/use-threads-panel';

export function AgentNavigationToggle() {
  const navigation = useThreadsPanel();
  if (!navigation) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 max-lg:hidden"
      aria-label="Toggle agent navigation"
      tooltip="Toggle agent navigation"
      onClick={navigation.toggle}
    >
      <PanelEdgeIcon side="left" />
    </Button>
  );
}
