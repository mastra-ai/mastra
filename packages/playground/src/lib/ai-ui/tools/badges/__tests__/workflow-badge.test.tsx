// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowBadge } from '../workflow-badge';
import { badgeWorkflow, badgeWorkflowRuns, RUN_ID, WORKFLOW_ID } from './fixtures/workflow-badge';
import { ToolCallProvider } from '@/services/tool-call-provider';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(() => cleanup());

const Providers = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TestLinkProvider>
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
          </TestLinkProvider>
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
  it('keeps the workflow collapsed while exposing navigation in the tool header', async () => {
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

    const badge = await screen.findByTestId('workflow-badge');
    expect(badge.getAttribute('role')).toBe('group');
    expect(badge.getAttribute('aria-label')).toBe(`Tool: workflow-${WORKFLOW_ID}`);
    expect(badge.querySelector('svg')?.classList.contains('text-accent3')).toBe(true);
    expect(screen.queryByTestId('workflow-graph-viewport')).toBeNull();

    const workflowLink = screen.getByRole('link', { name: 'Go to workflow' });
    expect(workflowLink.getAttribute('href')).toBe(`/workflows/${WORKFLOW_ID}/graph/${RUN_ID}`);

    fireEvent.click(screen.getByRole('button', { name: new RegExp(badgeWorkflow.name) }));
    await waitFor(() => expect(screen.getByTestId('workflow-graph-viewport')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'See run' })).toBeNull();
  });
});
