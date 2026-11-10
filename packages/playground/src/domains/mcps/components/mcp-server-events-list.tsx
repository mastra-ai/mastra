import type { McpServerInfo } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { eventSearch } from '../hooks/use-event-drawer-param';
import { useMcpServerEvents } from '../hooks/use-mcp-server-events';
import { McpEventDeliveryBadges } from './mcp-event-drawer/mcp-event-delivery-badges';

const COLUMNS = 'auto 1fr auto';

/** The event types a server declares. Render it only for servers that report `events_capability`. */
export function McpServerEventsList({ server }: { server: McpServerInfo }) {
  const { data, isLoading, isError } = useMcpServerEvents(server.id);
  const events = data?.events ?? [];
  const { Link } = useLinkComponent();
  const { containerRef, getRowProps } = useDataListKeyboard({ count: events.length });

  return (
    <section className="flex flex-col gap-3">
      <Txt as="h2" variant="heading">
        Events
      </Txt>

      {isLoading && <DataListSkeleton columns={COLUMNS} />}
      {isError && <Notice variant="destructive">Could not load this server's events.</Notice>}
      {data && (
        <DataList columns={COLUMNS} scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Name</DataList.TopCell>
            <DataList.TopCell>Description</DataList.TopCell>
            <DataList.TopCell>Delivery</DataList.TopCell>
          </DataList.Top>

          {events.length === 0 && <DataList.NoMatch message="This server declares no events" />}

          {events.map((event, index) => (
            <DataList.RowLink
              key={event.name}
              to={`/mcps/${server.id}${eventSearch(event.name)}`}
              LinkComponent={Link}
              {...getRowProps(index)}
            >
              <DataList.NameCell>{event.name}</DataList.NameCell>
              <DataList.DescriptionCell>{event.description}</DataList.DescriptionCell>
              <DataList.TextCell>
                <McpEventDeliveryBadges delivery={event.delivery} />
              </DataList.TextCell>
            </DataList.RowLink>
          ))}
        </DataList>
      )}
    </section>
  );
}
