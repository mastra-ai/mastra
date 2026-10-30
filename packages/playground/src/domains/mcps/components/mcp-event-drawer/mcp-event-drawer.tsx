import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { RadioIcon } from 'lucide-react';
import { useEventDrawerParam } from '../../hooks/use-event-drawer-param';
import { McpEventDrawerBody } from './mcp-event-drawer-body';

/** The side drawer an MCP event type opens in, driven by `?event=`. */
export function McpEventDrawer({ serverId }: { serverId: string }) {
  const { eventName, close } = useEventDrawerParam();

  return (
    <DataPanel open={eventName !== undefined} onClose={close} title={eventName ?? ''}>
      <DataPanel.Header>
        <DataPanel.Heading>
          <Icon size="sm" className="text-muted-foreground">
            <RadioIcon />
          </Icon>
          <span className="truncate">{eventName}</span>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" tooltip="Close event" onClick={close} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      <DataPanel.Content className="flex flex-col gap-4 px-3">
        {/* Keyed by event, so switching events closes the previous stream and starts the body fresh. */}
        {eventName && <McpEventDrawerBody key={eventName} serverId={serverId} eventName={eventName} />}
      </DataPanel.Content>
    </DataPanel>
  );
}
