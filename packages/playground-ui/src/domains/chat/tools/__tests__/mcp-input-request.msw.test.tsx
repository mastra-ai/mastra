// @vitest-environment jsdom
import type { BackgroundTaskResponse } from '@mastra/client-js';
import { useChat } from '@mastra/react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolCard } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import { BACKGROUND_TASK_ID, backgroundTask } from './fixtures/background-task';
import {
  deferredSuspendedThread,
  foregroundSuspendedMetadata,
  foregroundSuspendedThread,
  MCP_TASK_ID,
  resumedEvent,
  signInRequest,
  SUSPENDED_AT,
  suspendedBackgroundTask,
  suspendedEvent,
} from './fixtures/mcp-input-request';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, renderWithProviders, TEST_BASE_URL } from '@/test/render';

const API = `${TEST_BASE_URL}/api`;

/** An SSE body the test writes background-task events into. */
const openEventStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({ start: c => void (controller = c) });
  return {
    body,
    emit: async (event: unknown) => {
      await act(async () => {
        controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      });
    },
    connected: () => controller !== undefined,
  };
};

interface Backend {
  /** What `GET /background-tasks/:id` answers with now. */
  task: BackgroundTaskResponse;
  reads: number;
  resumes: unknown[];
  resumeStatus: number;
}

/** A background task that answers reads with its current state and records each resume. */
const serveBackground = (task: BackgroundTaskResponse, stream?: ReadableStream<Uint8Array>) => {
  const backend: Backend = { task, reads: 0, resumes: [], resumeStatus: 200 };
  server.use(
    http.get(`${API}/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${API}/background-tasks/stream`, () => {
      return new HttpResponse(stream ?? '', { headers: { 'Content-Type': 'text/event-stream' } });
    }),
    http.get(`${API}/background-tasks/:taskId`, () => {
      backend.reads++;
      return HttpResponse.json(backend.task);
    }),
    http.post(`${API}/background-tasks/:taskId/resume`, async ({ request }) => {
      backend.resumes.push(await request.json());
      if (backend.resumeStatus === 409) {
        return HttpResponse.json({ error: 'Background task is not suspended' }, { status: 409 });
      }
      backend.task = backgroundTask('running');
      return HttpResponse.json(backend.task);
    }),
  );
  return backend;
};

const deferredCall: ToolCardProps = {
  toolName: 'reports_slow_report',
  input: { topic: 'q3' },
  output: `Background task started with id ${BACKGROUND_TASK_ID}`,
  toolCallId: 'call-1',
  state: 'output-available',
  backgroundTaskId: BACKGROUND_TASK_ID,
  backgroundTaskStatus: 'running',
};

const Shell = ({
  props,
  approveToolcall = () => {},
}: {
  props: ToolCardProps;
  approveToolcall?: (toolCallId: string, resumeData?: unknown) => void;
}) => (
  <MemoryRouter>
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={approveToolcall}
        declineToolcall={() => {}}
        approveToolcallGenerate={() => {}}
        declineToolcallGenerate={() => {}}
        approveNetworkToolcall={() => {}}
        declineNetworkToolcall={() => {}}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        <ToolCard {...props} />
      </ToolCallProvider>
    </TooltipProvider>
  </MemoryRouter>
);

/** Shorter than the chip's 2s poll, so a change seen within it came from the answer, not a poll. */
const BEFORE_NEXT_POLL_MS = 1000;

const card = () => screen.queryByTestId('mcp-input-request');
const chipText = () => screen.getByTestId('mcp-task-chip').textContent;

afterEach(() => vi.restoreAllMocks());

describe('a deferred call whose MCP task asks for input', () => {
  describe('when the chat is opened after the task suspended', () => {
    it("shows the server's question and sends the accepted form to the background task", async () => {
      const backend = serveBackground(suspendedBackgroundTask());
      renderWithProviders(<Shell props={deferredCall} />);

      expect(await screen.findByText('Include the draft figures in the Q3 report?')).toBeTruthy();
      expect(chipText()).toContain('task · input required');

      const request = await screen.findByTestId('mcp-input-request');
      fireEvent.change(within(request).getByRole('textbox'), { target: { value: 'use final numbers' } });
      fireEvent.click(within(request).getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toEqual({
        resumeData: { inputResponses: { confirm: { action: 'accept', content: { note: 'use final numbers' } } } },
        suspendedAt: SUSPENDED_AT,
      });
      await waitFor(() => expect(card()).toBeNull(), { timeout: BEFORE_NEXT_POLL_MS });
      expect(chipText()).toContain('task · working');
    });

    it.each([
      ['Decline', 'decline'],
      ['Cancel', 'cancel'],
    ])('%s sends the %s action', async (button, action) => {
      const backend = serveBackground(suspendedBackgroundTask());
      renderWithProviders(<Shell props={deferredCall} />);

      fireEvent.click(
        await within(await screen.findByTestId('mcp-input-request')).findByRole('button', { name: button }),
      );

      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toEqual({
        resumeData: { inputResponses: { confirm: { action } } },
        suspendedAt: SUSPENDED_AT,
      });
    });
  });

  describe('when the task suspends and resumes while the chat is open', () => {
    it('shows the question, then hides it once the task works again', async () => {
      const events = openEventStream();
      const backend = serveBackground(backgroundTask('running'), events.body);
      renderWithProviders(<Shell props={deferredCall} />);
      await waitFor(() => expect(events.connected()).toBe(true));
      await waitFor(() => expect(backend.reads).toBeGreaterThan(0));
      expect(card()).toBeNull();

      backend.task = suspendedBackgroundTask();
      await events.emit(suspendedEvent());

      expect(await screen.findByText('Include the draft figures in the Q3 report?')).toBeTruthy();
      expect(chipText()).toContain('task · input required');

      backend.task = backgroundTask('running');
      await events.emit(resumedEvent);

      await waitFor(() => expect(card()).toBeNull());
      expect(chipText()).toContain('task · working');
    });
  });

  describe('when the live call still shows its MCP task progress', () => {
    // Before a reload the client writes the task's progress records into the part, not the
    // "Background task started" placeholder, so the card must not hang on the placeholder.
    const liveCall: ToolCardProps = {
      ...deferredCall,
      output: [
        {
          type: 'mcp-task',
          taskId: MCP_TASK_ID,
          status: 'working',
          createdAt: '2026-10-27T12:00:00.000Z',
          serverName: 'reports',
        },
      ],
    };

    it('shows the question when the task suspends and answers it', async () => {
      const events = openEventStream();
      const backend = serveBackground(backgroundTask('running'), events.body);
      renderWithProviders(<Shell props={liveCall} />);
      await waitFor(() => expect(events.connected()).toBe(true));
      await waitFor(() => expect(backend.reads).toBeGreaterThan(0));

      backend.task = suspendedBackgroundTask();
      await events.emit(suspendedEvent());

      const request = await screen.findByTestId('mcp-input-request');
      expect(within(request).getByText('Include the draft figures in the Q3 report?')).toBeTruthy();
      expect(chipText()).toContain('task · input required');

      fireEvent.click(within(request).getByRole('button', { name: 'Decline' }));
      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toEqual({
        resumeData: { inputResponses: { confirm: { action: 'decline' } } },
        suspendedAt: SUSPENDED_AT,
      });
    });
  });

  describe('when someone else answered first', () => {
    it('says so and reads the task again', async () => {
      const backend = serveBackground(suspendedBackgroundTask());
      backend.resumeStatus = 409;
      renderWithProviders(<Shell props={deferredCall} />);
      const decline = await within(await screen.findByTestId('mcp-input-request')).findByRole('button', {
        name: 'Decline',
      });
      const readsBefore = backend.reads;

      fireEvent.click(decline);

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expect.stringContaining('This request was already answered or has moved on.'),
      );
      await waitFor(() => expect(backend.reads).toBeGreaterThan(readsBefore), { timeout: BEFORE_NEXT_POLL_MS });
    });
  });

  describe('when the server asks the user to visit a URL', () => {
    it('links to it and sends accept on Done', async () => {
      const backend = serveBackground(suspendedBackgroundTask(signInRequest));
      renderWithProviders(<Shell props={deferredCall} />);

      const request = await screen.findByTestId('mcp-input-request');
      expect(within(request).getByText('Sign in to the reports service to continue.')).toBeTruthy();
      expect(
        within(request)
          .getByRole('link', { name: /open link/i })
          .getAttribute('href'),
      ).toBe('https://reports.example.com/oauth/start');

      fireEvent.click(within(request).getByRole('button', { name: 'Done' }));

      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toEqual({
        resumeData: { inputResponses: { signin: { action: 'accept' } } },
        suspendedAt: SUSPENDED_AT,
      });
    });

    it('does not link a non-web URL', async () => {
      serveBackground(
        suspendedBackgroundTask({
          ...signInRequest,
          requests: {
            signin: {
              method: 'elicitation/create',
              params: { mode: 'url', message: 'Go', url: 'javascript:alert(1)' },
            },
          },
        }),
      );
      renderWithProviders(<Shell props={deferredCall} />);

      const request = await screen.findByTestId('mcp-input-request');
      expect(within(request).queryByRole('link')).toBeNull();
      expect(within(request).getByText(/can't answer/)).toBeTruthy();
    });
  });
});

describe('a foreground call whose MCP task asks for input', () => {
  const foregroundCall: ToolCardProps = {
    toolName: 'reports_slow_report',
    input: { topic: 'q3' },
    output: undefined,
    toolCallId: 'call-1',
    state: 'input-available',
    metadata: foregroundSuspendedMetadata(),
  };

  it('answers through the chat resume, not the background task route', async () => {
    const backend = serveBackground(suspendedBackgroundTask());
    const approveToolcall = vi.fn<(toolCallId: string, resumeData?: unknown) => void>();
    renderWithProviders(<Shell props={foregroundCall} approveToolcall={approveToolcall} />);

    const request = await screen.findByTestId('mcp-input-request');
    expect(chipText()).toContain('task · input required');
    fireEvent.click(within(request).getByRole('button', { name: 'Decline' }));

    expect(approveToolcall).toHaveBeenCalledWith('call-1', { inputResponses: { confirm: { action: 'decline' } } });
    expect(backend.reads).toBe(0);
    expect(backend.resumes).toHaveLength(0);
  });

  it('finds its suspension saved under the tool name while the run is live', async () => {
    serveBackground(suspendedBackgroundTask());
    const entry = foregroundSuspendedMetadata().suspendedTools['call-1'];
    renderWithProviders(
      <Shell
        props={{ ...foregroundCall, metadata: { mode: 'stream', suspendedTools: { reports_slow_report: entry } } }}
      />,
    );

    expect(await screen.findByText('Include the draft figures in the Q3 report?')).toBeTruthy();
  });

  it("ignores another call's suspension saved under the same tool name", async () => {
    serveBackground(suspendedBackgroundTask());
    const other = foregroundSuspendedMetadata();
    renderWithProviders(
      <Shell
        props={{
          ...foregroundCall,
          metadata: {
            mode: 'stream',
            suspendedTools: { reports_slow_report: { ...other.suspendedTools['call-1'], toolCallId: 'call-0' } },
          },
        }}
      />,
    );

    await screen.findByTestId('tool-badge');
    expect(card()).toBeNull();
  });
});

describe('the chat while a deferred call waits for input', () => {
  it('stays free to send', () => {
    const { result } = renderHookWithProviders(() =>
      useChat({ agentId: 'tasks-agent', threadId: 'thread-1', initialMessages: deferredSuspendedThread.messages }),
    );

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isAwaitingToolApproval).toBe(false);
  });

  it('is held, by contrast, while a foreground call waits', () => {
    const { result } = renderHookWithProviders(() =>
      useChat({ agentId: 'tasks-agent', threadId: 'thread-1', initialMessages: foregroundSuspendedThread.messages }),
    );

    expect(result.current.isAwaitingToolApproval).toBe(true);
  });
});
