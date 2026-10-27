import type { McpServerTask } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { McpTaskDrawer } from '../mcp-task-drawer/mcp-task-drawer';
import { MCPDetail } from '../MCPDetail';
import { v2Server } from './fixtures/mcp-servers';
import {
  bobFailedTask,
  bobKey,
  cancelledTask,
  completedTask,
  failedTask,
  inputTask,
  manyTasks,
  reportTools,
  samplingTask,
  taskList,
  tasksServer,
  unavailableTaskList,
  workingTask,
} from './fixtures/mcp-tasks';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const TASKS_URL = `${TEST_BASE_URL}/api/mcp/reports/tasks`;

/**
 * Serves `tasks` like the list route: filters by status, surface, client and key, and pages
 * 50 at a time with the offset as the cursor. `onList` sees each request's query.
 */
const listTasks = (tasks: () => McpServerTask[], onList?: (query: URLSearchParams) => void) =>
  http.get(TASKS_URL, ({ request }) => {
    const query = new URL(request.url).searchParams;
    onList?.(query);
    const matches = (value: string, wanted: string | null) => wanted === null || value === wanted;
    const matching = tasks().filter(
      task =>
        matches(task.status, query.get('status')) &&
        matches(task.surface, query.get('surface')) &&
        matches(task.principalKey, query.get('client')) &&
        matches(task.taskKey, query.get('key')),
    );
    const start = Number(query.get('cursor') ?? 0);
    const limit = Number(query.get('limit') ?? 50);
    const end = start + limit;
    return HttpResponse.json(taskList(matching.slice(start, end), end < matching.length ? String(end) : undefined));
  });

const useTasks = (...tasks: McpServerTask[]) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
    listTasks(() => tasks),
  );

const renderDetail = (detailServer = tasksServer, initialEntry = '/mcps/reports') =>
  renderWithProviders(
    <TestLinkProvider>
      <MCPDetail isLoading={false} server={detailServer} />
      <McpTaskDrawer serverId="reports" />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const renderDrawer = (taskKey: string) =>
  renderWithProviders(<McpTaskDrawer serverId="reports" />, {
    router: { initialEntries: [`/mcps/reports?task=${taskKey}`] },
  });

const tasksSection = async () => screen.findByRole('region', { name: 'Tasks' });

describe('MCPDetail tasks section', () => {
  describe('when the server does not run tools as tasks', () => {
    it('renders no Tasks section or Task column and never requests tasks', async () => {
      const onTasks = vi.fn<() => void>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tasks`, () => {
          onTasks();
          return HttpResponse.json(taskList([]));
        }),
      );

      renderDetail(v2Server);

      expect(await screen.findByText('slow_report')).not.toBeNull();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByRole('heading', { name: 'Tasks' })).toBeNull();
      expect(screen.queryByText('Task')).toBeNull();
      expect(onTasks).not.toHaveBeenCalled();
    });
  });

  describe('when the server runs tools as tasks', () => {
    it('marks each task tool with its mode, whether it is required and recovery, and leaves other tools blank', async () => {
      useTasks();
      renderDetail();

      const slow = (await screen.findByText('slow_report')).closest('a');
      await waitFor(() => expect(slow?.textContent).toContain('always'));
      expect(slow?.textContent).toContain('required');
      expect(slow?.textContent).toContain('recover');
      const approve = screen.getByText('approve_and_send').closest('a');
      expect(approve?.textContent).toContain('auto');
      expect(approve?.textContent).not.toContain('required');
      expect(approve?.textContent).not.toContain('recover');
      const echo = screen.getByText('quick_echo').closest('a');
      expect(echo?.textContent).not.toMatch(/always|auto/);
    });
  });

  describe('when the server has tasks in every state', () => {
    it('lists each with its status, open inputs and a short key linking to the drawer', async () => {
      useTasks(workingTask, inputTask, completedTask, failedTask, cancelledTask);
      renderDetail();

      const section = await tasksSection();
      const row = (await within(section).findByRole('link', { name: /approve_and_send task inputKey/ })).textContent;
      expect(row).toContain('input required');
      expect(row).toContain('1');
      expect(row).toContain('inputKey…');
      for (const status of ['working', 'completed', 'failed', 'cancelled']) {
        expect(within(section).getByText(status)).not.toBeNull();
      }
      expect(
        within(section)
          .getByRole('link', { name: /slow_report task workingK/ })
          .getAttribute('href'),
      ).toBe('/mcps/reports?task=workingKey0001');
      expect(within(section).getAllByRole('button', { name: /Show only tasks from client/ })).toHaveLength(5);
    });
  });

  describe('when the server has more tasks than one page', () => {
    it('loads the older ones on request', async () => {
      useTasks(...manyTasks(51));
      renderDetail();

      const section = await tasksSection();
      expect(await within(section).findByText('Showing the 50 most recent tasks.')).not.toBeNull();
      expect(within(section).queryByRole('link', { name: /pagedKey000050/ })).toBeNull();

      fireEvent.click(within(section).getByRole('button', { name: 'Load more' }));

      await waitFor(() =>
        expect(within(section).getAllByRole('link', { name: /slow_report task pagedKey/ })).toHaveLength(51),
      );
      expect(within(section).queryByRole('button', { name: 'Load more' })).toBeNull();
    });
  });

  describe('when every task was listed', () => {
    it('offers no more to load', async () => {
      useTasks(workingTask, completedTask);
      renderDetail();

      const section = await tasksSection();
      await within(section).findByRole('link', { name: /slow_report task workingK/ });
      expect(within(section).queryByRole('button', { name: 'Load more' })).toBeNull();
      expect(within(section).queryByText(/most recent/)).toBeNull();
    });
  });

  describe('when the URL filters by status', () => {
    it('asks the server for those tasks only', async () => {
      const onList = vi.fn<(query: URLSearchParams) => void>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
        listTasks(() => [workingTask, failedTask, bobFailedTask], onList),
      );
      renderDetail(tasksServer, '/mcps/reports?status=failed');

      const section = await tasksSection();
      await waitFor(() => expect(within(section).getAllByRole('link', { name: /task / })).toHaveLength(2));
      expect(within(section).queryByText('working')).toBeNull();
      expect(onList.mock.calls.some(([query]) => query.get('status') === 'failed' && !query.has('limit'))).toBe(true);
      expect(within(section).getByRole('group', { name: 'Task filters' }).textContent).toContain('failed');
    });
  });

  describe('when a client is picked from a row', () => {
    it("lists only that client's tasks", async () => {
      useTasks(workingTask, failedTask, bobFailedTask);
      renderDetail();

      const section = await tasksSection();
      fireEvent.click(
        await within(section).findByRole('button', { name: `Show only tasks from client ${bobKey.slice(0, 8)}…` }),
      );

      await waitFor(() => expect(within(section).getAllByRole('link', { name: /task / })).toHaveLength(1));
      expect(within(section).getByRole('link', { name: /slow_report task bobFaile/ })).not.toBeNull();
      expect(within(section).getByRole('group', { name: 'Task filters' }).textContent).toContain(
        `${bobKey.slice(0, 8)}…`,
      );
    });
  });

  describe('when the filters match nothing', () => {
    it('says no task matches', async () => {
      useTasks(workingTask);
      renderDetail(tasksServer, '/mcps/reports?status=cancelled');

      expect(await within(await tasksSection()).findByText('No tasks match these filters')).not.toBeNull();
    });
  });

  describe('when a task is looked up by its MCP task id', () => {
    it('sends the id in the body and opens the task it finds', async () => {
      useTasks(inputTask);
      const onFind = vi.fn<(body: unknown, url: string) => void>();
      server.use(
        http.post(`${TASKS_URL}/find`, async ({ request }) => {
          onFind(await request.json(), request.url);
          return HttpResponse.json({ task: inputTask });
        }),
      );
      renderDetail();

      const section = await tasksSection();
      fireEvent.change(within(section).getByLabelText('MCP task id'), { target: { value: ' raw-mcp-task-id ' } });
      fireEvent.click(within(section).getByRole('button', { name: 'Find' }));

      expect(await screen.findByRole('region', { name: 'Input request approve' })).not.toBeNull();
      expect(onFind).toHaveBeenCalledWith({ taskId: 'raw-mcp-task-id' }, `${TASKS_URL}/find`);
    });

    it('says when no task has that id', async () => {
      useTasks(inputTask);
      server.use(http.post(`${TASKS_URL}/find`, () => HttpResponse.json({ error: 'Task not found' }, { status: 404 })));
      renderDetail();

      const section = await tasksSection();
      fireEvent.change(within(section).getByLabelText('MCP task id'), { target: { value: 'nope' } });
      fireEvent.click(within(section).getByRole('button', { name: 'Find' }));

      expect(await within(section).findByText('No task with that id.')).not.toBeNull();
    });
  });

  describe('when the server has no tasks yet', () => {
    it('says so', async () => {
      useTasks();
      renderDetail();

      expect(await within(await tasksSection()).findByText('No tasks yet')).not.toBeNull();
    });
  });

  describe("when the server's task store can't be listed", () => {
    it('explains instead of showing an error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
        http.get(TASKS_URL, () => HttpResponse.json(unavailableTaskList('not_listable'))),
      );
      renderDetail();

      expect(await within(await tasksSection()).findByText("This server's task store can't be listed.")).not.toBeNull();
    });
  });

  describe('when the Studio session is scoped to a resource', () => {
    it('explains the list needs an unscoped session', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
        http.get(TASKS_URL, () => HttpResponse.json(unavailableTaskList('resource_scoped'))),
      );
      renderDetail();

      expect(
        await within(await tasksSection()).findByText(
          'The task list needs a Studio session that is not scoped to a resource.',
        ),
      ).not.toBeNull();
    });
  });

  describe('when a working task completes', () => {
    it('picks up the new status without a reload', async () => {
      let current: McpServerTask = workingTask;
      server.use(
        http.get(`${TEST_BASE_URL}/api/mcp/:serverId/tools`, () => HttpResponse.json(reportTools)),
        listTasks(() => [current]),
      );
      renderDetail();

      const section = await tasksSection();
      expect(await within(section).findByText('working')).not.toBeNull();
      current = { ...workingTask, status: 'completed' };
      expect(await within(section).findByText('completed', {}, { timeout: 4_000 })).not.toBeNull();
    });
  });
});

describe('MCP task drawer', () => {
  describe('when opened on a working task', () => {
    it('cancels it by key', async () => {
      useTasks(workingTask);
      const onCancel = vi.fn<(taskKey: string) => void>();
      server.use(
        http.post(`${TASKS_URL}/:taskKey/cancel`, ({ params }) => {
          onCancel(String(params.taskKey));
          return HttpResponse.json({ success: true });
        }),
      );
      renderDrawer(workingTask.taskKey);

      fireEvent.click(await screen.findByRole('button', { name: 'Cancel task' }));

      await waitFor(() => expect(onCancel).toHaveBeenCalledWith('workingKey0001'));
    });
  });

  describe('when the task finished before the cancel landed', () => {
    it('says the task moved on', async () => {
      useTasks(workingTask);
      server.use(
        http.post(`${TASKS_URL}/:taskKey/cancel`, () =>
          HttpResponse.json({ error: 'Task not found' }, { status: 404 }),
        ),
      );
      renderDrawer(workingTask.taskKey);

      fireEvent.click(await screen.findByRole('button', { name: 'Cancel task' }));

      expect(
        await screen.findByText('The task is no longer waiting for this; the list has been refreshed.'),
      ).not.toBeNull();
    });
  });

  describe('when the task is waiting for an elicitation', () => {
    it('submits the form as an accepted answer', async () => {
      useTasks(inputTask);
      const onAnswer = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${TASKS_URL}/:taskKey/input`, async ({ request }) => {
          onAnswer(await request.json());
          return HttpResponse.json({ success: true });
        }),
      );
      renderDrawer(inputTask.taskKey);

      const request = await screen.findByRole('region', { name: 'Input request approve' });
      expect(within(request).getByText('Send "hello"?')).not.toBeNull();
      fireEvent.change(within(request).getByLabelText(/Note/), { target: { value: 'ship it' } });
      fireEvent.click(within(request).getByRole('button', { name: 'Accept' }));

      await waitFor(() =>
        expect(onAnswer).toHaveBeenCalledWith({
          inputResponses: { approve: { action: 'accept', content: { note: 'ship it' } } },
        }),
      );
    });

    it('declines without content', async () => {
      useTasks(inputTask);
      const onAnswer = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${TASKS_URL}/:taskKey/input`, async ({ request }) => {
          onAnswer(await request.json());
          return HttpResponse.json({ success: true });
        }),
      );
      renderDrawer(inputTask.taskKey);

      const request = await screen.findByRole('region', { name: 'Input request approve' });
      fireEvent.click(within(request).getByRole('button', { name: 'Decline' }));

      await waitFor(() =>
        expect(onAnswer).toHaveBeenCalledWith({ inputResponses: { approve: { action: 'decline' } } }),
      );
    });
  });

  describe('when the task is waiting for a request Studio cannot answer', () => {
    it('shows the request read-only', async () => {
      useTasks(samplingTask);
      renderDrawer(samplingTask.taskKey);

      const request = await screen.findByRole('region', { name: 'Input request draft' });
      expect(within(request).getByText(/can't answer a sampling\/createMessage request/)).not.toBeNull();
      expect(within(request).queryByRole('button', { name: 'Accept' })).toBeNull();
    });
  });

  describe('when the task completed', () => {
    it('shows the result and offers no cancel', async () => {
      useTasks(completedTask);
      renderDrawer(completedTask.taskKey);

      expect(await screen.findByRole('heading', { name: 'Result' })).not.toBeNull();
      expect(screen.getByText(/Report done/)).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel task' })).toBeNull();
    });
  });

  describe('when the task failed', () => {
    it('shows the status message and error', async () => {
      useTasks(failedTask);
      renderDrawer(failedTask.taskKey);

      expect(await screen.findByRole('heading', { name: 'Error' })).not.toBeNull();
      expect(screen.getAllByText(/tool exploded/).length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Cancel task' })).toBeNull();
    });
  });

  describe('when the task is no longer listed', () => {
    it('says so', async () => {
      useTasks();
      renderDrawer('goneKey');

      expect(await screen.findByText('This task is no longer listed.')).not.toBeNull();
    });
  });
});
