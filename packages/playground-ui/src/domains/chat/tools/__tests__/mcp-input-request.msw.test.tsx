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
  confirmRequest,
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
import type { McpInputRequest, McpInputRequestPayload } from '@/domains/chat/tools/mcp-input-request';
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
  toolCallApprovals = {},
}: {
  props: ToolCardProps;
  approveToolcall?: (toolCallId: string, resumeData?: unknown) => void;
  toolCallApprovals?: { [toolCallId: string]: { status: 'approved' | 'declined' } };
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
        toolCallApprovals={toolCallApprovals}
        networkToolCallApprovals={{}}
      >
        <ToolCard {...props} />
      </ToolCallProvider>
    </TooltipProvider>
  </MemoryRouter>
);

/** Shorter than the chip's 2s poll, so a change seen within it came from the answer, not a poll. */
const BEFORE_NEXT_POLL_MS = 1000;

const FIRST_ASKED_AT = '2026-10-27T12:00:05.000Z';
const SECOND_ASKED_AT = '2026-10-27T12:01:10.000Z';

const card = () => screen.queryByTestId('mcp-input-request');
const chipStatus = () => within(screen.getByTestId('mcp-task-chip')).getByText(/^task /).textContent;

afterEach(() => vi.restoreAllMocks());

describe('a deferred call whose MCP task asks for input', () => {
  describe('when the chat is opened after the task suspended', () => {
    it("shows the server's question and sends the accepted form to the background task", async () => {
      const backend = serveBackground(suspendedBackgroundTask());
      renderWithProviders(<Shell props={deferredCall} />);

      expect(await screen.findByText('Include the draft figures in the Q3 report?')).toBeTruthy();
      expect(chipStatus()).toBe('task input required');

      const request = await screen.findByTestId('mcp-input-request');
      fireEvent.change(within(request).getByRole('textbox'), { target: { value: 'use final numbers' } });
      fireEvent.click(within(request).getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toEqual({
        resumeData: { inputResponses: { confirm: { action: 'accept', content: { note: 'use final numbers' } } } },
        suspendedAt: SUSPENDED_AT,
      });
      await waitFor(() => expect(card()).toBeNull(), { timeout: BEFORE_NEXT_POLL_MS });
      expect(chipStatus()).toBe('task working');
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
      expect(chipStatus()).toBe('task input required');

      backend.task = backgroundTask('running');
      await events.emit(resumedEvent);

      await waitFor(() => expect(card()).toBeNull());
      expect(chipStatus()).toBe('task working');
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
      expect(chipStatus()).toBe('task input required');

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

  describe("when the server's form is not the flat one the MCP spec allows", () => {
    const askWith = (requestedSchema: Record<string, unknown>): McpInputRequestPayload => ({
      ...confirmRequest,
      requests: { confirm: { method: 'elicitation/create', params: { message: 'Fill this in', requestedSchema } } },
    });
    const nested = (depth: number): Record<string, unknown> =>
      depth === 0 ? { type: 'string' } : { type: 'object', properties: { inner: nested(depth - 1) } };

    it.each([
      ['nested', nested(500)],
      [
        'too wide',
        {
          type: 'object',
          properties: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`f${i}`, { type: 'string' }])),
        },
      ],
    ])('does not draw a %s schema as a form', async (_, requestedSchema) => {
      serveBackground(suspendedBackgroundTask(askWith(requestedSchema)));
      renderWithProviders(<Shell props={deferredCall} />);

      const request = await screen.findByTestId('mcp-input-request');
      expect(within(request).getByText(/can't answer/)).toBeTruthy();
      expect(within(request).queryByRole('button', { name: 'Accept' })).toBeNull();
    });

    it("draws the fields but never runs the server's pattern", async () => {
      const backend = serveBackground(
        suspendedBackgroundTask(
          askWith({
            type: 'object',
            properties: { note: { type: 'string', pattern: '^(a+)+$', description: 'Note' } },
          }),
        ),
      );
      renderWithProviders(<Shell props={deferredCall} />);

      const request = await screen.findByTestId('mcp-input-request');
      fireEvent.change(within(request).getByRole('textbox'), { target: { value: `${'a'.repeat(40)}!` } });
      fireEvent.click(within(request).getByRole('button', { name: 'Accept' }));

      await waitFor(() => expect(backend.resumes).toHaveLength(1));
      expect(backend.resumes[0]).toMatchObject({
        resumeData: { inputResponses: { confirm: { action: 'accept', content: { note: `${'a'.repeat(40)}!` } } } },
      });
    });
  });
});

describe('a deferred call whose server asks for more than Studio shows', () => {
  const ask = (message: string): McpInputRequest => ({ method: 'elicitation/create', params: { message } });
  const requests = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`q${i}`, ask(`Q${i}?`)]));

  it.each([
    ['too many questions', { ...confirmRequest, requests: requests(21) }],
    ['a huge message', { ...confirmRequest, requests: { confirm: ask('x'.repeat(2_001)) } }],
    [
      'huge params',
      {
        ...confirmRequest,
        requests: { confirm: { method: 'elicitation/create', params: { message: 'Hi', blob: 'x'.repeat(70_000) } } },
      },
    ],
  ])('shows one card for %s and cancels every request', async (_, payload: McpInputRequestPayload) => {
    const backend = serveBackground(suspendedBackgroundTask(payload));
    renderWithProviders(<Shell props={deferredCall} />);

    const request = await screen.findByTestId('mcp-input-request');
    expect(within(request).getByText('reports sent more than Studio can show here.')).toBeTruthy();
    expect(within(request).queryAllByRole('region')).toHaveLength(0);
    expect(within(request).queryByRole('button', { name: 'Accept' })).toBeNull();

    fireEvent.click(within(request).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(backend.resumes).toHaveLength(1));
    const cancelled = Object.fromEntries(Object.keys(payload.requests).map(key => [key, { action: 'cancel' }]));
    expect(backend.resumes[0]).toEqual({ resumeData: { inputResponses: cancelled }, suspendedAt: SUSPENDED_AT });
  });

  it('still draws twenty questions', async () => {
    serveBackground(suspendedBackgroundTask({ ...confirmRequest, requests: requests(20) }));
    renderWithProviders(<Shell props={deferredCall} />);

    const request = await screen.findByTestId('mcp-input-request');
    expect(within(request).getByText('Q19?')).toBeTruthy();
    expect(within(request).queryByText(/more than Studio can show/)).toBeNull();
  });
});

describe('a deferred call whose request keys share names with object built-ins', () => {
  it('answers each one and sends every answer', async () => {
    // Built from JSON so `__proto__` is an own key, as it is when the payload arrives over the wire.
    const payload = JSON.parse(
      JSON.stringify({
        ...confirmRequest,
        requests: {},
      }).replace(
        '"requests":{}',
        '"requests":{"constructor":{"method":"elicitation/create","params":{"message":"First?","mode":"url","url":"https://a.example.com"}},"__proto__":{"method":"elicitation/create","params":{"message":"Second?","mode":"url","url":"https://b.example.com"}}}',
      ),
    ) as McpInputRequestPayload;
    expect(Object.keys(payload.requests)).toEqual(['constructor', '__proto__']);
    const backend = serveBackground(suspendedBackgroundTask(payload));
    renderWithProviders(<Shell props={deferredCall} />);

    const request = await screen.findByTestId('mcp-input-request');
    const done = (key: string) =>
      within(within(request).getByRole('region', { name: `Input request ${key}` })).getByRole('button', {
        name: 'Done',
      });
    expect(done('constructor')).toHaveProperty('disabled', false);
    expect(done('__proto__')).toHaveProperty('disabled', false);

    fireEvent.click(done('constructor'));
    expect(backend.resumes).toHaveLength(0);
    fireEvent.click(done('__proto__'));

    await waitFor(() => expect(backend.resumes).toHaveLength(1));
    const sent = (backend.resumes[0] as { resumeData: { inputResponses: Record<string, unknown> } }).resumeData
      .inputResponses;
    expect(Object.keys(sent)).toEqual(['constructor', '__proto__']);
    expect(Object.getOwnPropertyDescriptor(sent, 'constructor')?.value).toEqual({ action: 'accept' });
    expect(Object.getOwnPropertyDescriptor(sent, '__proto__')?.value).toEqual({ action: 'accept' });
  });
});

describe('a live deferred call with no MCP task progress yet', () => {
  it('shows input required on the chip while its task waits', async () => {
    serveBackground(suspendedBackgroundTask());
    renderWithProviders(
      <Shell
        props={{ ...deferredCall, output: undefined, state: 'input-available', backgroundTaskStatus: 'running' }}
      />,
    );

    await screen.findByTestId('mcp-input-request');
    await waitFor(() => expect(chipStatus()).toBe('task input required'));
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
    expect(chipStatus()).toBe('task input required');
    fireEvent.click(within(request).getByRole('button', { name: 'Decline' }));

    expect(approveToolcall).toHaveBeenCalledWith('call-1', { inputResponses: { confirm: { action: 'decline' } } });
    expect(backend.reads).toBe(0);
    expect(backend.resumes).toHaveLength(0);
  });

  it('takes a fresh answer when the same call asks the same question again', async () => {
    serveBackground(suspendedBackgroundTask());
    const approveToolcall = vi.fn<(toolCallId: string, resumeData?: unknown) => void>();
    const asked = (requestedAt: string): ToolCardProps => ({
      ...foregroundCall,
      metadata: foregroundSuspendedMetadata({ ...confirmRequest, requestedAt }),
    });
    const { rerender } = renderWithProviders(<Shell props={asked(FIRST_ASKED_AT)} approveToolcall={approveToolcall} />);

    const first = await screen.findByTestId('mcp-input-request');
    fireEvent.change(within(first).getByRole('textbox'), { target: { value: 'draft numbers' } });
    fireEvent.click(within(first).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(approveToolcall).toHaveBeenCalledTimes(1));

    // The run resumed and the server asked `confirm` again. The chat still lists the call as approved.
    rerender(
      <Shell
        props={asked(SECOND_ASKED_AT)}
        approveToolcall={approveToolcall}
        toolCallApprovals={{ 'call-1': { status: 'approved' } }}
      />,
    );

    const second = await screen.findByTestId('mcp-input-request');
    const note = within(second).getByRole<HTMLInputElement>('textbox');
    expect(note.value).toBe('');
    expect(within(second).getByRole('button', { name: 'Decline' })).toHaveProperty('disabled', false);
    fireEvent.click(within(second).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(approveToolcall).toHaveBeenCalledTimes(2));
    expect(approveToolcall).toHaveBeenLastCalledWith('call-1', { inputResponses: { confirm: { action: 'decline' } } });
  });

  it("shows why an answer didn't go through and clears it on the next try", async () => {
    serveBackground(suspendedBackgroundTask());
    const approveToolcall = vi
      .fn<(toolCallId: string, resumeData?: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('The run is no longer suspended.'))
      .mockResolvedValueOnce(undefined);
    renderWithProviders(<Shell props={foregroundCall} approveToolcall={approveToolcall} />);

    const request = await screen.findByTestId('mcp-input-request');
    fireEvent.click(within(request).getByRole('button', { name: 'Decline' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The run is no longer suspended.');

    fireEvent.click(await within(request).findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(approveToolcall).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('shows the question without answer buttons in a network run', async () => {
    serveBackground(suspendedBackgroundTask());
    const approveToolcall = vi.fn<(toolCallId: string, resumeData?: unknown) => void>();
    renderWithProviders(
      <Shell
        props={{ ...foregroundCall, metadata: { ...foregroundSuspendedMetadata(), mode: 'network' } }}
        approveToolcall={approveToolcall}
      />,
    );

    const request = await screen.findByTestId('mcp-input-request');
    expect(within(request).getByText('Include the draft figures in the Q3 report?')).toBeTruthy();
    expect(within(request).getByText("Studio can't answer this request in a network run yet.")).toBeTruthy();
    for (const name of ['Accept', 'Decline', 'Cancel']) {
      expect(within(request).queryByRole('button', { name })).toBeNull();
    }
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
