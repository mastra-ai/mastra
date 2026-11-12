// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackgroundWorkPanel } from '../background-work-panel';
import { ChatAgentContext, ChatMessagesContext } from '@/domains/chat/context/chat-context';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import {
  BACKGROUND_TASK_ID,
  backgroundTask,
  DEV_SERVER_PID,
  deferredReportTurn,
  devServer,
  devServerExitNotice,
  devServerKilled,
  devServerOutput,
  devServerTurn,
  eventStream,
  processList,
  reportTaskNotice,
  reportTaskStream,
  THREAD_ID,
  WORKSPACE_ID,
} from '@/domains/chat/tools/__tests__/fixtures/background-task';
import { ToolCard } from '@/domains/chat/tools/tool-card';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const API = `${TEST_BASE_URL}/api`;
const PROCESSES = `${API}/workspaces/${WORKSPACE_ID}/sandbox/processes`;

beforeEach(() => {
  server.use(http.get(`${API}/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })));
});

const ChatShell = ({ messages, children }: { messages: MastraDBMessage[]; children: ReactNode }) => (
  <MemoryRouter>
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={() => {}}
        declineToolcall={() => {}}
        approveToolcallGenerate={() => {}}
        declineToolcallGenerate={() => {}}
        approveNetworkToolcall={() => {}}
        declineNetworkToolcall={() => {}}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        <ChatAgentContext.Provider value={{ agentId: 'tasks-agent', threadId: THREAD_ID }}>
          <ChatMessagesContext.Provider value={{ messages }}>{children}</ChatMessagesContext.Provider>
        </ChatAgentContext.Provider>
      </ToolCallProvider>
    </TooltipProvider>
  </MemoryRouter>
);

/** The transcript and the dock above the composer, as the agent chat lays them out. */
const renderChat = (messages: MastraDBMessage[]) =>
  renderWithProviders(
    <ChatShell messages={messages}>
      {messages.map(message => (
        <MessageRow key={message.id} message={message} />
      ))}
      <BackgroundWorkPanel />
    </ChatShell>,
  );

/** The thread's sandbox: lists the dev server until it is killed, and records what Studio asked. */
const serveSandbox = () => {
  let running = true;
  const requests: string[] = [];
  server.use(
    http.get(PROCESSES, ({ request }) => {
      requests.push(`list ${new URL(request.url).search}`);
      return HttpResponse.json(processList(...(running ? [devServer()] : [])));
    }),
    http.get(`${PROCESSES}/:pid`, ({ request, params }) => {
      requests.push(`read ${String(params.pid)} ${new URL(request.url).search}`);
      return HttpResponse.json(devServerOutput);
    }),
    http.post(`${PROCESSES}/:pid/kill`, ({ request, params }) => {
      requests.push(`kill ${String(params.pid)} ${new URL(request.url).search}`);
      running = false;
      return HttpResponse.json(devServerKilled);
    }),
  );
  return requests;
};

const confirm = async (action: string) => {
  fireEvent.click(screen.getByRole('button', { name: action }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: action }));
};

describe('a background command in the chat', () => {
  describe('when the sandbox still runs its process', () => {
    it('reads as running in the background, apart from finished commands', async () => {
      serveSandbox();
      renderChat([devServerTurn]);

      const card = await screen.findByTestId('background-command-badge');
      await waitFor(() => expect(card.getAttribute('data-status')).toBe('running'));
      expect(within(card).getByText('Background')).not.toBeNull();
    });

    it('shows the end of its output in the dock, then kills it once the reader confirms', async () => {
      const requests = serveSandbox();
      renderChat([devServerTurn]);
      const panel = screen.getByTestId('background-work-panel');
      const row = await within(panel).findByRole('group', { name: 'Run: npm run dev' });

      fireEvent.click(within(row).getByRole('button', { name: /npm run dev/ }));
      expect(await within(row).findByText('ready on http://localhost:3000')).not.toBeNull();
      await confirm('Kill process');

      await waitFor(() => expect(within(panel).queryByRole('group', { name: 'Run: npm run dev' })).toBeNull());
      expect(requests).toContain(`read ${DEV_SERVER_PID} ?threadId=${THREAD_ID}&tail=50`);
      expect(requests).toContain(`kill ${DEV_SERVER_PID} ?threadId=${THREAD_ID}`);
      expect(screen.getByTestId('background-command-badge').getAttribute('data-status')).toBe('idle');
    });
  });

  describe('when its exit notice reached the thread', () => {
    it('shows the exit code on the call and a finished row, without asking the sandbox', async () => {
      const requests = serveSandbox();
      const { queryClient } = renderChat([devServerTurn, devServerExitNotice(1)]);

      const notice = await screen.findByRole('group', { name: 'Command finished: npm run dev' });
      expect(within(notice).getByText('exit 1')).not.toBeNull();
      const card = screen.getByTestId('background-command-badge');
      expect(within(card).getByText('exit 1')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
      expect(screen.queryByTestId('background-work-panel')).toBeNull();
      await waitForMutationsIdle(queryClient);
      expect(requests).toEqual([]);
    });
  });
});

describe('a deferred call in the chat', () => {
  describe('when its task streams as running on the thread', () => {
    it('lists it with its output in the dock and cancels it once the reader confirms', async () => {
      const cancelled: string[] = [];
      server.use(
        http.get(`${API}/background-tasks/stream`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('threadId')).toBe(THREAD_ID);
          return new HttpResponse(eventStream(reportTaskStream), { headers: { 'Content-Type': 'text/event-stream' } });
        }),
        http.post(`${API}/background-tasks/:taskId/cancel`, ({ params }) => {
          cancelled.push(String(params.taskId));
          return HttpResponse.json(backgroundTask('cancelled'));
        }),
      );
      renderWithProviders(
        <ChatShell messages={[deferredReportTurn]}>
          <BackgroundWorkPanel />
        </ChatShell>,
      );

      const row = await screen.findByRole('group', { name: 'Reports slow report' });
      fireEvent.click(within(row).getByRole('button', { name: /Reports slow report/ }));
      expect(await within(row).findByText('Pulled Q3 revenue')).not.toBeNull();
      await confirm('Cancel task');

      await waitFor(() => expect(cancelled).toEqual([BACKGROUND_TASK_ID]));
    });
  });

  describe('when its task was cancelled', () => {
    it('says so and never reads the task', async () => {
      const reads: string[] = [];
      server.use(
        http.get(`${API}/background-tasks/:taskId`, ({ params }) => {
          reads.push(String(params.taskId));
          return HttpResponse.json(backgroundTask('cancelled'));
        }),
      );
      const { queryClient } = renderWithProviders(
        <ChatShell messages={[]}>
          <ToolCard
            toolName="reports_slow_report"
            input={{ topic: 'q3' }}
            output={`Background task started with id ${BACKGROUND_TASK_ID}`}
            toolCallId="call-1"
            state="output-available"
            backgroundTaskId={BACKGROUND_TASK_ID}
            backgroundTaskStatus="cancelled"
          />
        </ChatShell>,
      );

      const card = await screen.findByTestId('tool-badge');
      expect(within(card).getByText('cancelled')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
      await waitForMutationsIdle(queryClient);
      expect(reads).toEqual([]);
    });
  });

  describe('when its task notice reached the thread', () => {
    it.each([
      ['completed', 'Task finished: reports_slow_report'],
      ['failed', 'Task failed: reports_slow_report'],
    ] as const)('draws a %s task as its own row', async (status, name) => {
      renderChat([reportTaskNotice(status)]);

      expect(await screen.findByRole('group', { name })).not.toBeNull();
    });
  });
});
