// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowBadge } from '../workflow-badge';
import { badgeWorkflow, badgeWorkflowRuns, RUN_ID, WORKFLOW_ID } from './fixtures/workflow-badge';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(() => cleanup());

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
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
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('WorkflowBadge', () => {
  // Regression guard: the agent-chat badge renders WorkflowGraph, whose nodes
  // call useWorkflowStepDetail / useWorkflowSelectedStep. The badge must supply
  // those providers itself or the graph throws
  // "useWorkflowStepDetail must be used within WorkflowStepDetailProvider".
  it('renders the workflow graph for a completed run without throwing the step-detail provider error', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(badgeWorkflow)),
      http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json(badgeWorkflowRuns)),
      http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${RUN_ID}`, () =>
        HttpResponse.json(badgeWorkflowRuns.runs[0]),
      ),
    );

    render(
      <WorkflowBadge
        workflowId={WORKFLOW_ID}
        toolName={`workflow-${WORKFLOW_ID}`}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
        result={{ runId: RUN_ID, status: 'success' }}
      />,
      { wrapper: Providers },
    );

    await waitFor(() => expect(screen.getByTestId('workflow-badge')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('workflow-graph-viewport')).toBeTruthy());
  });
});
