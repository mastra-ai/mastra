// @vitest-environment jsdom
import type { SandboxProcess } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackgroundWorkPanel } from '../background-work-panel';
import { BackgroundWorkProvider } from '../background-work-provider';
import { ChatAgentContext, ChatMessagesContext } from '@/domains/chat/context/chat-context';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import {
  backgroundCommandTurn,
  DEV_SERVER_PID,
  deferredReportTurn,
  devServer,
  devServerExitNotice,
  devServerKilled,
  devServerOutput,
  devServerTurn,
  eventStream,
  liveDevServerExitNotice,
  processList,
  reportTaskNotice,
  reportTaskStream,
  THREAD_ID,
  WORKSPACE_ID,
} from '@/domains/chat/tools/__tests__/fixtures/background-task';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const API = `${TEST_BASE_URL}/api`;
const PROCESSES = `${API}/workspaces/${WORKSPACE_ID}/sandbox/processes`;

beforeEach(() => {
  server.use(http.get(`${API}/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })));
});

/** What any transcript renders in: a router, tooltips and approvals, with no chat around it. */
const TranscriptProviders = ({ children }: { children: ReactNode }) => (
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
        {children}
      </ToolCallProvider>
    </TooltipProvider>
  </MemoryRouter>
);

/** The agent chat: a thread whose background work is tracked. */
const ChatProviders = ({
  messages,
  threadId = THREAD_ID,
  children,
}: {
  messages: MastraDBMessage[];
  threadId?: string;
  children: ReactNode;
}) => (
  <TranscriptProviders>
    <ChatAgentContext.Provider value={{ agentId: 'tasks-agent', threadId }}>
      <ChatMessagesContext.Provider value={{ messages }}>
        <BackgroundWorkProvider messages={messages}>{children}</BackgroundWorkProvider>
      </ChatMessagesContext.Provider>
    </ChatAgentContext.Provider>
  </TranscriptProviders>
);

/** The transcript and the dock above the composer, as the agent chat lays them out. */
const renderChat = (messages: MastraDBMessage[]) =>
  renderWithProviders(
    <ChatProviders messages={messages}>
      {messages.map(message => (
        <MessageRow key={message.id} message={message} />
      ))}
      <BackgroundWorkPanel />
    </ChatProviders>,
  );

/** The thread's sandbox: lists `processes` until one is killed, and records what Studio asked. */
const serveSandbox = (processes: SandboxProcess[] = [devServer()]) => {
  let listed = processes;
  const requests: string[] = [];
  server.use(
    http.get(PROCESSES, ({ request }) => {
      requests.push(`list ${new URL(request.url).search}`);
      return HttpResponse.json(processList(...listed));
    }),
    http.get(`${PROCESSES}/:pid`, ({ request, params }) => {
      requests.push(`read ${String(params.pid)} ${new URL(request.url).search}`);
      return HttpResponse.json(devServerOutput);
    }),
    http.post(`${PROCESSES}/:pid/kill`, ({ request, params }) => {
      requests.push(`kill ${String(params.pid)} ${new URL(request.url).search}`);
      listed = listed.filter(process => process.pid !== params.pid);
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

  describe('when the sandbox lists the PID for another call', () => {
    it('does not take that process for this call', async () => {
      const other = devServer({ metadata: { ...devServer().metadata, toolCallId: 'call-other' } });
      serveSandbox([other]);
      renderChat([devServerTurn]);

      const card = await screen.findByTestId('background-command-badge');
      expect(await within(card).findByText('ended')).not.toBeNull();
      expect(card.getAttribute('data-status')).toBe('idle');
    });
  });

  describe('when the sandbox cannot be read', () => {
    it('says the status is unavailable, without a Background tag', async () => {
      server.use(http.get(PROCESSES, () => HttpResponse.json({ error: 'Sandbox not found' }, { status: 404 })));
      renderChat([devServerTurn]);

      const card = await screen.findByTestId('background-command-badge');
      expect(await within(card).findByText('status unavailable')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
    });
  });

  describe('when its exit notice reached the thread', () => {
    it.each([
      ['read back from memory', devServerExitNotice(1)],
      ['streamed live', liveDevServerExitNotice(1)],
    ])('shows the exit code on the call and a finished row, without asking the sandbox (%s)', async (_, notice) => {
      const requests = serveSandbox();
      const { queryClient } = renderChat([devServerTurn, notice]);

      const row = await screen.findByRole('group', { name: 'Command finished: npm run dev' });
      expect(within(row).getByText('exit 1')).not.toBeNull();
      const card = screen.getByTestId('background-command-badge');
      expect(within(card).getByText('exit 1')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
      expect(screen.queryByTestId('background-work-panel')).toBeNull();
      await waitForMutationsIdle(queryClient);
      expect(requests).toEqual([]);
    });
  });

  describe('when it renders outside a chat that tracks its thread', () => {
    const NoThread = ({ children }: { children: ReactNode }) => (
      <TranscriptProviders>
        <ChatAgentContext.Provider value={{ agentId: 'tasks-agent' }}>
          <BackgroundWorkProvider messages={[devServerTurn]}>{children}</BackgroundWorkProvider>
        </ChatAgentContext.Provider>
      </TranscriptProviders>
    );

    it.each([
      ['a read-only transcript', TranscriptProviders],
      ['a chat with no thread yet', NoThread],
    ])('draws as the command call it was in %s', async (_, Wrapper) => {
      const requests = serveSandbox();
      const { queryClient } = renderWithProviders(
        <Wrapper>
          <MessageRow message={devServerTurn} />
        </Wrapper>,
      );

      expect(await screen.findByTestId('sandbox-execution-badge')).not.toBeNull();
      expect(screen.queryByTestId('background-command-badge')).toBeNull();
      await waitForMutationsIdle(queryClient);
      expect(requests).toEqual([]);
    });
  });

  describe('when a later turn starts a command after every listed process exited', () => {
    it('reads the list again and shows the new process', async () => {
      let listed = [devServer({ running: false, exitCode: 0 })];
      server.use(http.get(PROCESSES, () => HttpResponse.json(processList(...listed))));
      const { rerender } = renderWithProviders(
        <ChatProviders messages={[devServerTurn]}>
          <MessageRow message={devServerTurn} />
          <BackgroundWorkPanel />
        </ChatProviders>,
      );
      expect(await within(await screen.findByTestId('background-command-badge')).findByText('exit 0')).not.toBeNull();

      const later = backgroundCommandTurn({
        messageId: 'assistant-later',
        pid: '5151',
        command: 'npm run watch',
        toolCallId: 'call-watch',
      });
      listed = [
        ...listed,
        devServer({ pid: '5151', command: 'npm run watch', metadata: { toolCallId: 'call-watch' } }),
      ];
      rerender(
        <ChatProviders messages={[devServerTurn, later]}>
          <MessageRow message={devServerTurn} />
          <MessageRow message={later} />
          <BackgroundWorkPanel />
        </ChatProviders>,
      );

      expect(
        await within(screen.getByTestId('background-work-panel')).findByRole('group', { name: 'Run: npm run watch' }),
      ).not.toBeNull();
    });
  });

  describe('when a later turn reuses the call id of a command that exited', () => {
    it('keeps the later command running and in the dock', async () => {
      const later = backgroundCommandTurn({ messageId: 'assistant-later', pid: '5151', command: 'npm run watch' });
      serveSandbox([devServer({ pid: '5151', command: 'npm run watch' })]);
      renderChat([devServerTurn, devServerExitNotice(1), later]);

      const [exited, running] = screen.getAllByTestId('background-command-badge');
      await waitFor(() => expect(running.getAttribute('data-status')).toBe('running'));
      expect(within(exited).getByText('exit 1')).not.toBeNull();
      expect(
        await within(screen.getByTestId('background-work-panel')).findByRole('group', { name: 'Run: npm run watch' }),
      ).not.toBeNull();
    });
  });
});

describe('a deferred call in the chat', () => {
  describe('when its task streams as running on the thread', () => {
    it('lists it read-only with its output in the dock', async () => {
      server.use(
        http.get(`${API}/background-tasks/stream`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('threadId')).toBe(THREAD_ID);
          return new HttpResponse(eventStream(reportTaskStream), { headers: { 'Content-Type': 'text/event-stream' } });
        }),
      );
      renderWithProviders(
        <ChatProviders messages={[deferredReportTurn]}>
          <BackgroundWorkPanel />
        </ChatProviders>,
      );

      const row = await screen.findByRole('group', { name: 'Reports slow report' });
      // Read-only: the row's only button opens it.
      const [trigger, ...others] = within(row).getAllByRole('button');
      expect(others).toHaveLength(0);
      fireEvent.click(trigger);
      expect(await within(row).findByText('Pulled Q3 revenue')).not.toBeNull();
    });
  });

  describe('when the task stream fails to connect', () => {
    it('says so and lists the task once the reader retries', async () => {
      let attempts = 0;
      server.use(
        http.get(`${API}/background-tasks/stream`, () => {
          attempts += 1;
          if (attempts === 1) return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
          return new HttpResponse(eventStream(reportTaskStream), { headers: { 'Content-Type': 'text/event-stream' } });
        }),
      );
      renderWithProviders(
        <ChatProviders messages={[deferredReportTurn]}>
          <BackgroundWorkPanel />
        </ChatProviders>,
      );

      expect(await screen.findByText("Couldn't follow background tasks")).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('group', { name: 'Reports slow report' })).not.toBeNull();
      expect(screen.queryByText("Couldn't follow background tasks")).toBeNull();
    });
  });

  describe('when the chat switches to another thread', () => {
    it("drops the previous thread's running tasks from the dock", async () => {
      server.use(
        http.get(`${API}/background-tasks/stream`, ({ request }) => {
          const ofThread = new URL(request.url).searchParams.get('threadId') === THREAD_ID;
          return new HttpResponse(eventStream(ofThread ? reportTaskStream : []), {
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }),
      );
      const { rerender } = renderWithProviders(
        <ChatProviders messages={[deferredReportTurn]}>
          <BackgroundWorkPanel />
        </ChatProviders>,
      );
      expect(await screen.findByRole('group', { name: 'Reports slow report' })).not.toBeNull();

      rerender(
        <ChatProviders messages={[deferredReportTurn]} threadId="thread-2">
          <BackgroundWorkPanel />
        </ChatProviders>,
      );

      await waitFor(() => expect(screen.queryByRole('group', { name: 'Reports slow report' })).toBeNull());
    });
  });

  describe('when its task notice reached the thread', () => {
    it.each([
      ['completed', 'Task finished: Reports slow report'],
      ['failed', 'Task failed: Reports slow report'],
    ] as const)('draws a %s task as its own row', async (status, name) => {
      renderChat([reportTaskNotice(status)]);

      expect(await screen.findByRole('group', { name })).not.toBeNull();
    });
  });
});
