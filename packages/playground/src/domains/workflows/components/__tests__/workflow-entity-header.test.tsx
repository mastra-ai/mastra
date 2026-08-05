// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowEntityHeader } from '../workflow-entity-header';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const baseWorkflow: GetWorkflowResponse = {
  name: 'demo-workflow',
  description: '',
  steps: {},
  allSteps: {},
  stepGraph: [],
  inputSchema: '',
  outputSchema: '',
  stateSchema: '',
} as GetWorkflowResponse;

function renderHeader(workflowId = 'demo-workflow') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkflowEntityHeader workflowId={workflowId} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('WorkflowEntityHeader', () => {
  it("renders the Stored badge when the workflow's origin is 'stored'", async () => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/demo-workflow`, () =>
        HttpResponse.json({ ...baseWorkflow, origin: 'stored' } satisfies GetWorkflowResponse),
      ),
    );

    renderHeader();

    await waitFor(() => expect(screen.getByText('Stored')).not.toBeNull());
  });

  it("does not render the Stored badge when the workflow's origin is 'code'", async () => {
    server.use(
      http.get(`${BASE_URL}/api/workflows/demo-workflow`, () =>
        HttpResponse.json({ ...baseWorkflow, origin: 'code' } satisfies GetWorkflowResponse),
      ),
    );

    renderHeader();

    // Header always renders the workflowId badge — wait for that to prove the query resolved.
    await waitFor(() => expect(screen.getByText('demo-workflow')).not.toBeNull());
    expect(screen.queryByText('Stored')).toBeNull();
  });
});
