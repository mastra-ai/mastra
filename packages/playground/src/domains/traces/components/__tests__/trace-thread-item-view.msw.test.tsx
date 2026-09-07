import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { TraceThreadItemView } from '../trace-thread-item-view';
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

  describe('when the trace contains tool and workflow executions', () => {
    it('renders every top-level execution with the agent chat cards', async () => {
      installToolTraceHandlers();

      const { queryClient } = renderWithProviders(<TraceThreadItemView traceId={TRACE_THREAD_ITEM_ID} />, {
        router: true,
      });

      expect(await screen.findByTestId('workflow-badge')).not.toBeNull();
      expect(await screen.findByTestId('workflow-graph-viewport')).not.toBeNull();
      expect(screen.getAllByTestId('tool-badge')).toHaveLength(3);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
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
        { router: true },
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
});
