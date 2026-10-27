import type { McpServerInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMcpServerTasks } from '../hooks/use-mcp-server-tasks';
import { shortTaskKey, taskSearch } from '../hooks/use-task-drawer-param';
import { McpTaskStatusBadge } from './mcp-task-drawer/mcp-task-status-badge';

const COLUMNS = 'minmax(0,1fr) auto auto auto auto auto auto';

const UNAVAILABLE = {
  not_listable: "This server's task store can't be listed.",
  resource_scoped: 'The task list needs a Studio session that is not scoped to a resource.',
} as const;

/**
 * The server's recent MCP tasks, across the clients that started them. Render it only for
 * servers that report `tasks_capability`.
 */
export function McpServerTasksList({ server }: { server: McpServerInfo }) {
  const { data, isLoading, isError } = useMcpServerTasks(server.id);
  const tasks = data?.tasks ?? [];
  const { Link } = useLinkComponent();
  const { containerRef, getRowProps } = useDataListKeyboard({ count: tasks.length });

  return (
    <section aria-label="Tasks" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Txt as="h2" variant="heading">
          Tasks
        </Txt>
        {data?.required && (
          <Badge size="sm" variant="warning" emphasis="subtle">
            requires task-capable clients
          </Badge>
        )}
      </div>

      {isLoading && <DataListSkeleton columns={COLUMNS} />}
      {isError && <Notice variant="destructive">Could not load this server's tasks.</Notice>}
      {data?.unavailable && <Notice variant="info">{UNAVAILABLE[data.unavailable]}</Notice>}
      {data && !data.unavailable && (
        <DataList columns={COLUMNS} scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Surface</DataList.TopCell>
            <DataList.TopCell>Status</DataList.TopCell>
            <DataList.TopCell>Created</DataList.TopCell>
            <DataList.TopCell>Updated</DataList.TopCell>
            <DataList.TopCell>Expires</DataList.TopCell>
            <DataList.TopCell>Inputs</DataList.TopCell>
            <DataList.TopCell>Key</DataList.TopCell>
          </DataList.Top>

          {tasks.length === 0 && <DataList.NoMatch message="No tasks yet" />}

          {tasks.map((task, index) => (
            <DataList.RowLink
              key={task.taskKey}
              to={`/mcps/${server.id}${taskSearch(task.taskKey)}`}
              LinkComponent={Link}
              aria-label={`${task.surface} task ${shortTaskKey(task.taskKey)}`}
              {...getRowProps(index)}
            >
              <DataList.NameCell>{task.surface}</DataList.NameCell>
              <DataList.Cell>
                <McpTaskStatusBadge status={task.status} />
              </DataList.Cell>
              <DataList.CreatedCell timestamp={task.createdAt} preset="day-time-seconds" />
              <DataList.Cell className="text-muted-foreground">
                <RelativeTimestamp value={task.lastUpdatedAt} />
              </DataList.Cell>
              <DataList.Cell className="text-muted-foreground">
                {task.expiresAt ? <RelativeTimestamp value={task.expiresAt} /> : 'never'}
              </DataList.Cell>
              <DataList.TextCell>{Object.keys(task.inputRequests ?? {}).length || '—'}</DataList.TextCell>
              <DataList.TextCell font="mono" className="text-muted-foreground">
                {shortTaskKey(task.taskKey)}
              </DataList.TextCell>
            </DataList.RowLink>
          ))}
        </DataList>
      )}
    </section>
  );
}
