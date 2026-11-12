// @vitest-environment jsdom
import type { SandboxProcess } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { memoryThreadMessagesQueryKey } from '@mastra/react/hooks/memory';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundWorkPanel } from '../background-work-panel';
import { BackgroundWorkProvider } from '../background-work-provider';
import { ChatAgentContext, ChatMessagesContext } from '@/domains/chat/context/chat-context';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import {
  BACKGROUND_TASK_ID,
  backgroundCommandTurn,
  backgroundTask,
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
import { foregroundSuspendedMetadata } from '@/domains/chat/tools/__tests__/fixtures/mcp-input-request';
import { ToolCard } from '@/domains/chat/tools/tool-card';
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
        <ChatProviders messages={[deferredReportTurn]}>
          <BackgroundWorkPanel />
        </ChatProviders>,
      );

      const row = await screen.findByRole('group', { name: 'Reports slow report' });
      fireEvent.click(within(row).getByRole('button', { name: /Reports slow report/ }));
      expect(await within(row).findByText('Pulled Q3 revenue')).not.toBeNull();
      await confirm('Cancel task');

      await waitFor(() => expect(cancelled).toEqual([BACKGROUND_TASK_ID]));
    });
  });

  describe('when the reader cancels its task from the dock after the turn ended', () => {
    it('marks the call cancelled, without waiting for the thread to be read again', async () => {
      server.use(
        http.get(
          `${API}/background-tasks/stream`,
          () => new HttpResponse(eventStream(reportTaskStream), { headers: { 'Content-Type': 'text/event-stream' } }),
        ),
        http.get(`${API}/background-tasks/:taskId`, () => HttpResponse.json(backgroundTask('running'))),
        http.post(`${API}/background-tasks/:taskId/cancel`, () => HttpResponse.json(backgroundTask('cancelled'))),
      );
      const { queryClient } = renderChat([deferredReportTurn]);
      const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
      const card = await screen.findByTestId('tool-badge');
      expect(within(card).getByText('Background')).not.toBeNull();

      await screen.findByRole('group', { name: 'Reports slow report' });
      await confirm('Cancel task');

      expect(await within(card).findByText('cancelled')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
      // The chat's messages and the memory panel's are read again, so the stored `cancelled` comes back.
      await waitFor(() => {
        expect(invalidated).toHaveBeenCalledWith({ queryKey: ['memory', 'messages', THREAD_ID] });
        expect(invalidated).toHaveBeenCalledWith({ queryKey: memoryThreadMessagesQueryKey(THREAD_ID) });
      });
    });
  });

  describe('when its task was cancelled', () => {
    const cancelledCall = (metadata?: ReturnType<typeof foregroundSuspendedMetadata>) => (
      <ChatProviders messages={[]}>
        <ToolCard
          toolName="reports_slow_report"
          input={{ topic: 'q3' }}
          output={`Background task started with id ${BACKGROUND_TASK_ID}`}
          toolCallId="call-1"
          state="output-available"
          backgroundTaskId={BACKGROUND_TASK_ID}
          backgroundTaskStatus="cancelled"
          metadata={metadata}
        />
      </ChatProviders>
    );

    it('says so and never reads the task', async () => {
      const reads: string[] = [];
      server.use(
        http.get(`${API}/background-tasks/:taskId`, ({ params }) => {
          reads.push(String(params.taskId));
          return HttpResponse.json(backgroundTask('cancelled'));
        }),
      );
      const { queryClient } = renderWithProviders(cancelledCall());

      const card = await screen.findByTestId('tool-badge');
      expect(within(card).getByText('cancelled')).not.toBeNull();
      expect(within(card).queryByText('Background')).toBeNull();
      await waitForMutationsIdle(queryClient);
      expect(reads).toEqual([]);
    });

    it('offers no answer to a question its task asked before it stopped', async () => {
      // The cancel reaches the chat as a stream chunk, which leaves the call's suspension in the message.
      renderWithProviders(cancelledCall(foregroundSuspendedMetadata()));

      const card = await screen.findByTestId('tool-badge');
      expect(within(card).getByText('cancelled')).not.toBeNull();
      expect(screen.queryByTestId('mcp-input-request')).toBeNull();
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
