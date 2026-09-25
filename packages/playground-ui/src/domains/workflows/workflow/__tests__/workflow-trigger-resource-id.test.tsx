// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { completedChunks } from '../../context/__tests__/fixtures/workflow-stream';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowTrigger } from '../workflow-trigger';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';
import { server } from '@/test/msw-server';

const TRIGGER_PROPS = { requestContext: {}, onRequestContextChange: () => {}, canExecute: true };

const BASE_URL = 'http://localhost:4111';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function TriggerPanel() {
  return <WorkflowTrigger {...useContext(WorkflowRunContext)} {...TRIGGER_PROPS} />;
}

function renderTrigger() {
  const bodies: { createRun: Record<string, unknown>[]; stream?: Record<string, unknown> } = { createRun: [] };
  server.use(
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/workflows/two-step-workflow`, () => HttpResponse.json(twoStepWorkflow)),
    http.post(`${BASE_URL}/api/workflows/two-step-workflow/create-run`, async ({ request }) => {
      bodies.createRun.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ runId: 'live-run' });
    }),
    http.post(`${BASE_URL}/api/workflows/two-step-workflow/stream`, async ({ request }) => {
      bodies.stream = (await request.json()) as Record<string, unknown>;
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
  return bodies;
}

describe('WorkflowTrigger resource attribution', () => {
  describe('when a resource ID is typed in the run options', () => {
    it('sends it when creating and when streaming the run', async () => {
      const bodies = renderTrigger();

      fireEvent.click(await screen.findByRole('button', { name: 'Run Options' }));
      fireEvent.change(screen.getByLabelText('Resource ID'), { target: { value: 'tenant-42' } });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => expect(bodies.stream).toBeDefined());
      expect(bodies.createRun.map(body => body.resourceId)).toEqual(['tenant-42', 'tenant-42']);
      expect(bodies.stream?.resourceId).toBe('tenant-42');
    });
  });

  describe('when the resource ID is left empty', () => {
    it('omits it from both requests', async () => {
      const bodies = renderTrigger();

      fireEvent.click(await screen.findByRole('button', { name: 'Run' }));

      await waitFor(() => expect(bodies.stream).toBeDefined());
      expect(bodies.createRun).toHaveLength(2);
      expect(bodies.createRun.filter(body => 'resourceId' in body)).toEqual([]);
      expect(bodies.stream && 'resourceId' in bodies.stream).toBe(false);
    });
  });
});
