// @vitest-environment jsdom
import type { GetWorkflowResponse, WorkflowBuilderSettingsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowHeader } from '../workflow-header';
import { rbacCapabilities } from '@/domains/agent-builder/hooks/__tests__/fixtures/auth';
import type { AuthCapabilities } from '@/domains/auth/types';
import { RouteHeaderActionsProvider, RouteHeaderActionsSlot } from '@/lib/route-header/route-header-actions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'demo-workflow';

const baseWorkflow: GetWorkflowResponse = {
  name: WORKFLOW_ID,
  description: '',
  steps: {},
  allSteps: {},
  stepGraph: [],
  inputSchema: '',
  outputSchema: '',
  stateSchema: '',
} as GetWorkflowResponse;

function serve({
  origin,
  capabilities,
  settings = { enabled: true },
}: {
  origin: GetWorkflowResponse['origin'];
  capabilities: AuthCapabilities;
  settings?: WorkflowBuilderSettingsResponse;
}) {
  server.use(
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () =>
      HttpResponse.json({ ...baseWorkflow, origin } satisfies GetWorkflowResponse),
    ),
    http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json({ schedules: [] })),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${BASE_URL}/api/editor/workflow-builder/settings`, () => HttpResponse.json(settings)),
  );
}

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RouteHeaderActionsProvider>
            <RouteHeaderActionsSlot />
            <WorkflowHeader workflowName={WORKFLOW_ID} workflowId={WORKFLOW_ID} />
          </RouteHeaderActionsProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('WorkflowHeader', () => {
  describe('when a dynamic workflow is opened by a user who can write', () => {
    it('offers an Edit in builder action linking to the workflow builder', async () => {
      serve({
        origin: 'dynamic',
        capabilities: rbacCapabilities(['stored-workflows:read', 'stored-workflows:write', 'workflows:execute']),
      });

      renderHeader();

      const link = await screen.findByRole('link', { name: /edit in builder/i });
      expect(link.getAttribute('href')).toBe(`/workflow-builder/${WORKFLOW_ID}`);
    });
  });

  describe('when a dynamic workflow is opened by a read-only user', () => {
    it('hides the Edit in builder action', async () => {
      serve({
        origin: 'dynamic',
        capabilities: rbacCapabilities(['stored-workflows:read']),
      });

      renderHeader();

      // Traces always renders — wait for it to prove the header resolved.
      await waitFor(() => expect(screen.getByRole('link', { name: /traces/i })).not.toBeNull());
      expect(screen.queryByRole('link', { name: /edit in builder/i })).toBeNull();
    });
  });

  describe('when a code-defined workflow is opened by a user who can write', () => {
    it('hides the Edit in builder action', async () => {
      serve({
        origin: 'code',
        capabilities: rbacCapabilities(['stored-workflows:read', 'stored-workflows:write', 'workflows:execute']),
      });

      renderHeader();

      await waitFor(() => expect(screen.getByRole('link', { name: /traces/i })).not.toBeNull());
      expect(screen.queryByRole('link', { name: /edit in builder/i })).toBeNull();
    });
  });
});
