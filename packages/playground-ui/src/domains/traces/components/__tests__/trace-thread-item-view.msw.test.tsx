// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { SpanType } from '@mastra/core/observability';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { createTraceTimeCursorStore } from '../../hooks/use-trace-time-cursor';
import { TraceThreadItemView } from '../trace-thread-item-view';
import { TraceTimeCursorProvider } from '../trace-time-cursor-provider';
import {
  agentTraceWithTools,
  agentTraceWithSkill,
  basicAgentTrace,
  TRACE_THREAD_ITEM_ID,
  TRACE_WORKFLOW_ID,
  traceWorkflow,
  traceWorkflowRuns,
} from './fixtures/trace-thread-item';
import { ActivatedSkillsProvider, useActivatedSkills } from '@/domains/agents/context/activated-skills-context';
import { BrowserToolCallsProvider, useBrowserToolCalls } from '@/domains/agents/context/browser-tool-calls-context';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const installToolTraceHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(agentTraceWithTools)),
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}`, () => HttpResponse.json(traceWorkflow)),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}/runs`, () => HttpResponse.json(traceWorkflowRuns)),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}/runs/:runId`, () =>
      HttpResponse.json(traceWorkflowRuns.runs[0]),
    ),
  );
};

const BrowserToolCallCount = () => {
  const { toolCalls } = useBrowserToolCalls();
  return <output data-testid="browser-tool-count">{toolCalls.length}</output>;
};

const SkillActivationStatus = () => {
  const { isSkillActivated } = useActivatedSkills();
  return <output data-testid="skill-activation-status">{String(isSkillActivated('trip-planning'))}</output>;
};

describe('TraceThreadItemView', () => {
  describe('when the trace contains a completed agent turn', () => {
    it('renders the user input and assistant response through the chat UI', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(basicAgentTrace)),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />);

      expect(await screen.findByText('Plan a weekend in Paris')).not.toBeNull();
      expect(screen.getByText('Your Paris itinerary is ready.')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('leaves feedback controls to the dedicated Feedback tab', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(basicAgentTrace)),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
          HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
        ),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />);

      expect(await screen.findByText('Plan a weekend in Paris')).not.toBeNull();
      expect(screen.queryByPlaceholderText('Leave feedback...')).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when the user input is a skill activation envelope', () => {
    it('renders the Skill row instead of the raw envelope', async () => {
      const [root, ...rest] = basicAgentTrace.spans;
      if (!root) throw new Error('fixture missing root span');
      const envelope = '<skill name="factory-triage">\nTriage the work item.\n</skill>';
      const spans = [
        { ...root, input: { messages: [{ role: 'user', content: [{ type: 'text', text: envelope }] }] } },
        ...rest,
      ];
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () =>
          HttpResponse.json({ ...basicAgentTrace, spans }),
        ),
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />);

      expect(await screen.findByLabelText('Skill: factory-triage')).not.toBeNull();
      expect(screen.queryByText(/<skill name=/)).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when the trace contains a reviewed submit_plan and an observational memory cycle', () => {
    it('shows the plan decision with its feedback and the observation badge', async () => {
      const [root] = basicAgentTrace.spans;
      if (!root) throw new Error('fixture missing root span');
      const spans = [
        ...basicAgentTrace.spans,
        {
          ...root,
          spanId: 'submit-plan',
          parentSpanId: root.spanId,
          name: "tool: 'submit_plan'",
          spanType: SpanType.TOOL_CALL,
          entityName: 'submit_plan',
          attributes: { toolCallId: 'call-plan' },
          input: { path: '.mastracode/plans/weekend.md' },
          output: {
            toolId: 'submit_plan',
            content: 'Plan was not approved.',
            submittedPlan: {
              title: 'Weekend in Paris',
              path: '.mastracode/plans/weekend.md',
              plan: '# Weekend in Paris',
              action: 'rejected',
              feedback: 'Add a museum on Sunday',
            },
          },
        },
        {
          ...root,
          spanId: 'om-observe',
          parentSpanId: root.spanId,
          name: 'memory: observe',
          spanType: SpanType.MEMORY_OPERATION,
          attributes: { operationType: 'observe', inputTokens: 1223 },
          input: null,
          output: null,
        },
      ];
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () =>
          HttpResponse.json({ ...basicAgentTrace, spans }),
        ),
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />);

      expect(await screen.findByText('Changes requested')).not.toBeNull();
      expect(screen.getByText('Add a museum on Sunday')).not.toBeNull();
      expect(screen.getByText(/Observed/)).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when the trace contains tool and workflow executions', () => {
    it('renders every top-level execution with the agent chat cards', async () => {
      installToolTraceHandlers();

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />, {});

      expect(await screen.findByTestId('workflow-badge')).not.toBeNull();
      expect(await screen.findByTestId('workflow-graph-viewport')).not.toBeNull();
      expect(screen.getAllByTestId('tool-badge')).toHaveLength(3);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when span highlighting is enabled', () => {
    it('exposes one highlight button per message, tool calls included', async () => {
      installToolTraceHandlers();

      const { queryClient } = renderWithProviders(
        <TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} onHighlightSpans={vi.fn()} />,
      );

      await screen.findByText('Your Paris itinerary is ready.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      // user text message + 4 tool messages + final assistant text message
      expect(screen.getAllByRole('button', { name: 'Highlight spans' })).toHaveLength(6);
    });

    it('highlights the spans behind a tool call only through its button, not by expanding it', async () => {
      installToolTraceHandlers();
      const onHighlightSpans = vi.fn();

      const { queryClient } = renderWithProviders(
        <TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} onHighlightSpans={onHighlightSpans} />,
      );

      await screen.findByText('Your Paris itinerary is ready.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      // Tool badges render in trace order: mcp-tool, client-tool, provider-tool.
      const [hotelBadge] = screen.getAllByTestId('tool-badge');
      fireEvent.click(within(hotelBadge).getAllByRole('button')[0]);
      expect(onHighlightSpans).not.toHaveBeenCalled();

      // Messages: user, workflow, mcp-tool, client-tool, provider-tool, assistant.
      const [, , hotelAction] = screen.getAllByRole('button', { name: 'Highlight spans' });
      fireEvent.click(hotelAction);
      expect(onHighlightSpans).toHaveBeenCalledTimes(1);
      expect(onHighlightSpans).toHaveBeenCalledWith(['agent-root', 'mcp-tool']);
    });
  });

  describe('when historical browser tools are rendered', () => {
    it('does not register them as active browser calls', async () => {
      installToolTraceHandlers();

      const { queryClient } = renderWithProviders(
        <BrowserToolCallsProvider>
          <TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />
          <BrowserToolCallCount />
        </BrowserToolCallsProvider>,
      );

      expect(await screen.findByTestId('workflow-badge')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getByTestId('browser-tool-count').textContent).toBe('0');
    });
  });

  describe('when a historical skill tool is rendered', () => {
    it('does not activate the skill in the current chat', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(agentTraceWithSkill)),
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
          HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
        ),
      );

      const { queryClient } = renderWithProviders(
        <ActivatedSkillsProvider>
          <TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />
          <SkillActivationStatus />
        </ActivatedSkillsProvider>,
      );

      expect(await screen.findByTestId('tool-badge')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getByTestId('skill-activation-status').textContent).toBe('false');
    });
  });

  describe('when the timeline time cursor is set', () => {
    const [root] = basicAgentTrace.spans;
    if (!root) throw new Error('fixture missing root span');
    const traceStart = new Date(root.startedAt).getTime();
    const at = (ms: number) => new Date(traceStart + ms);
    // Root runs 0–1000ms, a tool call 200–400ms, then the reply text block 500–700ms.
    const timedTrace = {
      ...basicAgentTrace,
      spans: [
        root,
        {
          ...root,
          spanId: 'hotel-tool',
          parentSpanId: root.spanId,
          name: "tool: 'searchHotels'",
          spanType: SpanType.TOOL_CALL,
          entityType: 'tool',
          entityId: 'searchHotels',
          entityName: 'searchHotels',
          attributes: { toolCallId: 'call-hotels' },
          input: { city: 'Paris' },
          output: { hotels: ['Left Bank'] },
          startedAt: at(200),
          endedAt: at(400),
        },
        {
          ...root,
          spanId: 'reply-chunk',
          parentSpanId: root.spanId,
          name: "chunk: 'text'",
          spanType: SpanType.MODEL_CHUNK,
          attributes: { chunkType: 'text' },
          input: null,
          output: { text: 'Your Paris itinerary is ready.' },
          startedAt: at(500),
          endedAt: at(700),
        },
      ],
    };

    const renderAtCursor = async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(timedTrace)),
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );
      const store = createTraceTimeCursorStore();
      const { queryClient } = renderWithProviders(
        <TraceTimeCursorProvider store={store}>
          <TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />
        </TraceTimeCursorProvider>,
      );
      expect(await screen.findByText('Your Paris itinerary is ready.')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      return store;
    };

    it('shows only the user message before the first tool call starts', async () => {
      const store = await renderAtCursor();

      act(() => store.set(traceStart + 100));

      expect(screen.getByText('Plan a weekend in Paris')).not.toBeNull();
      expect(screen.queryByTestId('tool-badge')).toBeNull();
      expect(screen.queryByText('Your Paris itinerary is ready.')).toBeNull();
    });

    it('shows the tool call once it has started, before the reply exists', async () => {
      const store = await renderAtCursor();

      act(() => store.set(traceStart + 300));

      expect(screen.getByTestId('tool-badge')).not.toBeNull();
      expect(screen.queryByText('Your Paris itinerary is ready.')).toBeNull();
    });

    it('shows the reply text that was already written while the run is still going', async () => {
      const store = await renderAtCursor();

      act(() => store.set(traceStart + 800));

      expect(screen.getByTestId('tool-badge')).not.toBeNull();
      expect(screen.getByText('Your Paris itinerary is ready.')).not.toBeNull();
    });

    it('says nothing has happened yet before the trace starts', async () => {
      const store = await renderAtCursor();

      act(() => store.set(traceStart - 1));

      expect(screen.getByText('Nothing has happened yet at this point.')).not.toBeNull();
    });

    it('shows the whole turn again once the cursor is cleared', async () => {
      const store = await renderAtCursor();
      act(() => store.set(traceStart + 100));

      act(() => store.set(null));

      expect(screen.getByTestId('tool-badge')).not.toBeNull();
      expect(screen.getByText('Your Paris itinerary is ready.')).not.toBeNull();
    });
  });
});
