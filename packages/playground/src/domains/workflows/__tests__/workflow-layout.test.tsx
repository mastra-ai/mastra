// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { baseWorkflow } from '../components/__tests__/fixtures/workflow';
import { runWithTimedSteps } from '../runs/__tests__/fixtures/workflow-runs';
import { WorkflowLayout } from '../workflow-layout';
import { server } from '@/test/msw-server';

// The graph + left-panel subtrees have their own dedicated tests. Here we only
// exercise the run-id gating in WorkflowLayout, so we stub the heavy children
// to a sentinel we can assert mounts only after the run resolves.
vi.mock('../workflow-header', () => ({
  WorkflowHeader: () => null,
}));
vi.mock('@/domains/workflows/components/workflow-information', () => ({
  WorkflowInformation: () => <div data-testid="workflow-information" />,
}));
vi.mock('@/domains/workflows/components/workflow-layout', () => ({
  WorkflowLayout: ({ children, leftSlot }: { children: React.ReactNode; leftSlot: React.ReactNode }) => (
    <div>
      {leftSlot}
      {children}
    </div>
  ),
}));

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'demo-workflow';
const RUN_ID = runWithTimedSteps.runId;

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/workflows/${WORKFLOW_ID}/${RUN_ID}`]}>
          <Routes>
            <Route
              path="/workflows/:workflowId/:runId"
              element={
                <WorkflowLayout>
                  <div data-testid="graph-children">graph</div>
                </WorkflowLayout>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('WorkflowLayout run-id gating', () => {
  it('does not mount the graph or left panel until the run-by-id query resolves', async () => {
    server.use(http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(baseWorkflow)));

    let releaseRun: () => void = () => {};
    const runGate = new Promise<void>(resolve => {
      releaseRun = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs/${RUN_ID}`, async () => {
        await runGate;
        await delay(0);
        return HttpResponse.json(runWithTimedSteps);
      }),
    );

    renderLayout();

    // While the run is still loading, the gate holds back the subtree.
    await waitFor(() => {
      expect(screen.queryByTestId('workflow-information')).toBeNull();
      expect(screen.queryByTestId('graph-children')).toBeNull();
    });

    releaseRun();

    // Once the run resolves, the graph + left panel mount.
    expect(await screen.findByTestId('graph-children')).not.toBeNull();
    expect(screen.getByTestId('workflow-information')).not.toBeNull();
  });
});
