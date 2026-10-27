import type { McpServerInfo, McpServerTask } from '@mastra/client-js';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { hueAccentColor } from '@mastra/playground-ui/utils/colors';
import { CheckCircleIcon, UserIcon, WrenchIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FormEvent, SyntheticEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  TASK_STATUS_LABELS,
  useFindMcpServerTask,
  useMcpServerTaskSurfaces,
  useMcpServerTasks,
} from '../hooks/use-mcp-server-tasks';
import type { McpTaskFilters } from '../hooks/use-mcp-server-tasks';
import {
  shortClientKey,
  shortTaskKey,
  taskSearch,
  useTaskDrawerParam,
  useTaskFilters,
} from '../hooks/use-task-drawer-param';
import { McpTaskStatusBadge } from './mcp-task-drawer/mcp-task-status-badge';

const COLUMNS = 'minmax(0,1fr) auto auto auto auto auto auto auto';

const UNAVAILABLE = {
  not_listable: "This server's task store can't be listed.",
  resource_scoped: 'The task list needs a Studio session that is not scoped to a resource.',
} as const;

const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];

const STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** The client's readable label, or a short form of its key for tasks stored without one. */
const clientName = (task: McpServerTask) => task.clientLabel ?? shortClientKey(task.principalKey);

const toItems = (filters: McpTaskFilters): FilterBarItem[] =>
  (['status', 'surface', 'client'] as const).flatMap(fieldId => {
    const value = filters[fieldId];
    return value ? [{ id: fieldId, fieldId, operatorId: 'is', value }] : [];
  });

const fromItems = (items: FilterBarItem[]): McpTaskFilters => {
  const valueOf = (fieldId: string) => {
    const value = items.find(item => item.fieldId === fieldId)?.value;
    return typeof value === 'string' && value ? value : undefined;
  };
  return {
    status: valueOf('status') as McpTaskFilters['status'],
    surface: valueOf('surface'),
    client: valueOf('client'),
  };
};

/**
 * The server's MCP tasks, newest first, across the clients that started them. Render it only
 * for servers that report `tasks_capability`.
 */
export function McpServerTasksList({ server }: { server: McpServerInfo }) {
  const { filters, setFilters } = useTaskFilters();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useMcpServerTasks(
    server.id,
    filters,
  );
  const { data: surfaces = [] } = useMcpServerTaskSurfaces(server.id);
  const tasks = useMemo(() => data?.pages.flatMap(page => page.tasks) ?? [], [data]);
  const unavailable = data?.pages[0]?.unavailable;
  const { containerRef, getRowProps } = useDataListKeyboard({ count: tasks.length });
  const filtered = toItems(filters).length > 0;

  // Clients in the loaded tasks, plus the filtered one, for the client filter's suggestions. The
  // filter matches the client key exactly; the label is what the chip shows.
  const clients = useMemo(() => {
    const names = new Map(tasks.map(task => [task.principalKey, clientName(task)]));
    if (filters.client && !names.has(filters.client)) names.set(filters.client, shortClientKey(filters.client));
    return [...names];
  }, [tasks, filters.client]);

  const fields = useMemo<FilterBarField[]>(
    () => [
      {
        id: 'status',
        label: 'Status',
        icon: CheckCircleIcon,
        color: hueAccentColor('orange'),
        operators: ['is'],
        strict: true,
        suggestions: STATUS_OPTIONS,
      },
      {
        id: 'surface',
        label: 'Surface',
        icon: WrenchIcon,
        color: hueAccentColor('blue'),
        operators: ['is'],
        strict: true,
        suggestions: surfaces.map(surface => ({ value: surface.name })),
      },
      {
        id: 'client',
        label: 'Client',
        icon: UserIcon,
        color: hueAccentColor('purple'),
        operators: ['is'],
        suggestions: clients.map(([value, label]) => ({ value, label })),
      },
    ],
    [surfaces, clients],
  );

  return (
    <section aria-label="Tasks" className="flex flex-col gap-3">
      <Txt as="h2" variant="heading">
        Tasks
      </Txt>

      {isError && <Notice variant="destructive">Could not load this server's tasks.</Notice>}
      {unavailable && <Notice variant="info">{UNAVAILABLE[unavailable]}</Notice>}

      {!unavailable && (
        <ActionRow>
          <ActionRow.Start>
            <FilterBar
              fields={fields}
              operators={OPERATORS}
              value={toItems(filters)}
              onValueChange={(items: FilterBarItem[]) => setFilters(fromItems(items))}
              createItemId={fieldId => fieldId}
              aria-label="Task filters"
              className="min-w-64 flex-1"
            >
              <FilterBar.Chips />
              <FilterBar.Input placeholder="Filter tasks…" />
            </FilterBar>
          </ActionRow.Start>
          <ActionRow.End>
            <FindTaskById serverId={server.id} />
          </ActionRow.End>
        </ActionRow>
      )}

      {isLoading && <DataListSkeleton columns={COLUMNS} />}
      {data && !unavailable && (
        <DataList columns={COLUMNS} scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Surface</DataList.TopCell>
            <DataList.TopCell>Status</DataList.TopCell>
            <DataList.TopCell>Created</DataList.TopCell>
            <DataList.TopCell>Updated</DataList.TopCell>
            <DataList.TopCell>Expires</DataList.TopCell>
            <DataList.TopCell>Inputs</DataList.TopCell>
            <DataList.TopCell>Key</DataList.TopCell>
            <DataList.TopCell>Client</DataList.TopCell>
          </DataList.Top>

          {tasks.length === 0 && (
            <DataList.NoMatch message={filtered ? 'No tasks match these filters' : 'No tasks yet'} />
          )}

          {tasks.map((task, index) => (
            <McpTaskRow
              key={task.taskKey}
              serverId={server.id}
              task={task}
              rowProps={getRowProps(index)}
              onFilterClient={() => setFilters({ ...filters, client: task.principalKey })}
            />
          ))}
        </DataList>
      )}

      {hasNextPage && (
        <div className="flex items-center gap-3">
          <Button variant="default" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
          <Txt variant="caption" tone="muted">
            Showing the {tasks.length} most recent {filtered ? 'matching ' : ''}tasks.
          </Txt>
        </div>
      )}
    </section>
  );
}

function McpTaskRow({
  serverId,
  task,
  rowProps,
  onFilterClient,
}: {
  serverId: string;
  task: McpServerTask;
  rowProps: ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;
  onFilterClient: () => void;
}) {
  const { Link } = useLinkComponent();
  const [params] = useSearchParams();
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <DataList.RowWrapper {...rowProps} onSelectRow={() => linkRef.current?.click()}>
      <DataList.RowLink
        ref={linkRef}
        colEnd={-2}
        to={`/mcps/${serverId}${taskSearch(task.taskKey, params)}`}
        LinkComponent={Link}
        tabIndex={-1}
        onClick={stopPropagation}
        aria-label={`${task.surface} task ${shortTaskKey(task.taskKey)}`}
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
      <DataList.Cell className="pr-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start font-mono"
          tooltip="Show only this client's tasks"
          aria-label={`Show only tasks from client ${clientName(task)}`}
          onClick={event => {
            event.stopPropagation();
            onFilterClient();
          }}
        >
          {clientName(task)}
        </Button>
      </DataList.Cell>
    </DataList.RowWrapper>
  );
}

/** Opens a task from the MCP task id a client sees, such as the one in a tool-call card. */
function FindTaskById({ serverId }: { serverId: string }) {
  const [taskId, setTaskId] = useState('');
  const find = useFindMcpServerTask(serverId);
  const { open } = useTaskDrawerParam();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = taskId.trim();
    if (!id) return;
    find.mutate(id, {
      onSuccess: ({ task }) => {
        setTaskId('');
        open(task.taskKey);
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2" aria-label="Find a task by MCP task id">
      <Input
        size="sm"
        value={taskId}
        onChange={event => {
          setTaskId(event.target.value);
          find.reset();
        }}
        placeholder="MCP task id"
        aria-label="MCP task id"
        aria-invalid={find.isError || undefined}
        className="w-56 font-mono"
      />
      <Button type="submit" size="sm" variant="default" disabled={!taskId.trim() || find.isPending}>
        Find
      </Button>
      {find.isError && (
        <Txt variant="caption" role="status" className="text-destructive-foreground">
          No task with that id.
        </Txt>
      )}
    </form>
  );
}
