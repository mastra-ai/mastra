// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { SpanType } from '@mastra/core/observability';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useLiveToolCalls } from '../../hooks/use-live-tool-calls';
import { TraceThreadItemView } from '../trace-thread-item-view';
import type { TraceThreadItemViewProps } from '../trace-thread-item-view';
import {
  agentTraceWithTools,
  agentTraceWithSkill,
  basicAgentTrace,
  TRACE_WORKFLOW_ID,
  traceWorkflow,
  traceWorkflowRuns,
} from './fixtures/trace-thread-item';
import { ActivatedSkillsProvider, useActivatedSkills } from '@/domains/agents/context/activated-skills-context';
import { BrowserToolCallsProvider, useBrowserToolCalls } from '@/domains/agents/context/browser-tool-calls-context';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const installToolTraceHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}`, () => HttpResponse.json(traceWorkflow)),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}/runs`, () => HttpResponse.json(traceWorkflowRuns)),
    http.get(`${TEST_BASE_URL}/api/workflows/${TRACE_WORKFLOW_ID}/runs/:runId`, () =>
      HttpResponse.json(traceWorkflowRuns.runs[0]),
    ),
  );
};

/** The view as Studio composes it: the trace's tool calls drawn with the chat's live cards. */
const LiveTraceThreadItemView = (props: TraceThreadItemViewProps) => (
  <TraceThreadItemView {...props} {...useLiveToolCalls()} />
);

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
      const { queryClient } = renderWithProviders(<TraceThreadItemView spans={basicAgentTrace.spans} />);

      expect(await screen.findByText('Plan a weekend in Paris')).not.toBeNull();
      expect(screen.getByText('Your Paris itinerary is ready.')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('leaves feedback controls to the dedicated Feedback tab', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
          HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
        ),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView spans={basicAgentTrace.spans} />);

      expect(await screen.findByText('Plan a weekend in Paris')).not.toBeNull();
      expect(screen.queryByPlaceholderText('Leave feedback')).toBeNull();
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
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView spans={spans} />);

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
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
      );

      const { queryClient } = renderWithProviders(<TraceThreadItemView spans={spans} />);

      expect(await screen.findByText('Changes requested')).not.toBeNull();
      expect(screen.getByText('Add a museum on Sunday')).not.toBeNull();
      expect(screen.getByText(/Observed/)).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  describe('when the trace contains tool and workflow executions', () => {
    it('draws every top-level execution from what the trace recorded', async () => {
      renderWithProviders(<TraceThreadItemView spans={agentTraceWithTools.spans} />);

      // The workflow, the MCP, client and provider tools: one card each.
      expect(await screen.findAllByTestId('tool-badge')).toHaveLength(4);
    });

    it('asks the network for nothing', async () => {
      const requests = recordRequests();
      renderWithProviders(<TraceThreadItemView spans={agentTraceWithTools.spans} />);

      await screen.findAllByTestId('tool-badge');

      expect(requests).toEqual([]);
    });

    describe('when the host draws them with the chat’s live cards', () => {
      it('draws the workflow with its graph', async () => {
        installToolTraceHandlers();

        const { queryClient } = renderWithProviders(<LiveTraceThreadItemView spans={agentTraceWithTools.spans} />);

        expect(await screen.findByTestId('workflow-badge')).not.toBeNull();
        expect(await screen.findByTestId('workflow-graph-viewport')).not.toBeNull();
        expect(screen.getAllByTestId('tool-badge')).toHaveLength(3);
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      });
    });
  });

  describe('when span highlighting is enabled', () => {
    it('exposes one highlight button per message, tool calls included', async () => {
      installToolTraceHandlers();

      const { queryClient } = renderWithProviders(
        <TraceThreadItemView spans={agentTraceWithTools.spans} onHighlightSpans={vi.fn()} />,
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
        <TraceThreadItemView spans={agentTraceWithTools.spans} onHighlightSpans={onHighlightSpans} />,
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

      // Through the live cards: the ones that could register a call, were it not read back.
      const { queryClient } = renderWithProviders(
        <BrowserToolCallsProvider>
          <LiveTraceThreadItemView spans={agentTraceWithTools.spans} />
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
        http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
          HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
        ),
      );

      const { queryClient } = renderWithProviders(
        <ActivatedSkillsProvider>
          <TraceThreadItemView spans={agentTraceWithSkill.spans} />
          <SkillActivationStatus />
        </ActivatedSkillsProvider>,
      );

      expect(await screen.findByTestId('tool-badge')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getByTestId('skill-activation-status').textContent).toBe('false');
    });
  });
});
