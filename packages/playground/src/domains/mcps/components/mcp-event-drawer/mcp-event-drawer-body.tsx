import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useMcpServerEvents } from '../../hooks/use-mcp-server-events';
import { McpEventDeliveryBadges } from './mcp-event-delivery-badges';
import { McpEventLivePanel } from './mcp-event-live-panel';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { ToolDrawerContent } from '@/domains/tools/components/tool-drawer/tool-drawer-content';
import { ToolSchemaSection } from '@/domains/tools/components/tool-drawer/tool-schema-section';

export interface McpEventDrawerBodyProps {
  serverId: string;
  eventName: string;
}

/** What the event is (Overview: delivery and schemas) apart from watching it (Playground). */
export function McpEventDrawerBody({ serverId, eventName }: McpEventDrawerBodyProps) {
  const { canExecute } = usePermissions();
  const { data, isLoading } = useMcpServerEvents(serverId);
  const event = data?.events.find(candidate => candidate.name === eventName);

  if (isLoading) return <DataPanel.LoadingData />;
  if (!data || !event) return <DataPanel.NoData>This server has no event "{eventName}".</DataPanel.NoData>;

  return (
    <ToolDrawerContent
      description={event.description}
      overview={
        <div className="grid grid-cols-1 gap-6">
          <McpEventDeliveryBadges delivery={event.delivery} />
          <ToolSchemaSection
            title="Arguments"
            schema={event.inputSchema}
            emptyMessage="This event takes no arguments."
            defaultsAreOptional
          />
          <ToolSchemaSection title="Payload" schema={event.payloadSchema} emptyMessage="No payload schema defined." />
        </div>
      }
      canRun={canExecute('mcp')}
      playground={<McpEventLivePanel serverId={serverId} event={event} testEmit={data.testEmit} />}
    />
  );
}
