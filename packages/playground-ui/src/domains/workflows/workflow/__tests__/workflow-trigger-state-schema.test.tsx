// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { stringify } from 'superjson';
import { afterEach, describe, expect, it } from 'vitest';
import { completedChunks } from '../../context/__tests__/fixtures/workflow-stream';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowTrigger } from '../workflow-trigger';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

afterEach(cleanup);

function TriggerPanel() {
  return <WorkflowTrigger {...useContext(WorkflowRunContext)} requestContext={{}} canExecute />;
}

describe('WorkflowTrigger on a workflow with state but no input schema', () => {
  describe('when run without filling in the form', () => {
    it('starts the run', async () => {
      // The server sends schemas superjson-serialized and omits `inputSchema` when the workflow has none.
      const workflow = {
        ...twoStepWorkflow,
        inputSchema: undefined,
        stateSchema: stringify({ type: 'object', properties: { count: { type: 'number' } } }),
      };
      const requests: string[] = [];
      server.use(
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
        http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(workflow)),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, () => {
          requests.push('create-run');
          return HttpResponse.json({ runId: 'live-run' });
        }),
        http.post(`${BASE_URL}/api/workflows/two-step-workflow/stream`, () => {
          requests.push('stream');
          return new HttpResponse(completedChunks.map(chunk => JSON.stringify(chunk) + '\x1e').join(''));
        }),
      );
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={client}>
            <WorkflowRunProvider workflowId="two-step-workflow">
              <TriggerPanel />
            </WorkflowRunProvider>
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Run' }));

      await waitFor(() => expect(requests).toContain('stream'));
      expect(screen.queryByText('Required')).toBeNull();
    });
  });
});
