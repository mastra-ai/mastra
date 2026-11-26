import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Processor } from '..';
import { workflowProcessor } from './fixtures/processor';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderProcessorWithCachedWorkflow = () => {
  const view = renderWithProviders(
    <Routes>
      <Route path="/processors/:processorId" element={<Processor />} />
      <Route path="/workflows/:workflowId/graph" element={<p>Workflow graph</p>} />
    </Routes>,
    { router: { initialEntries: [`/processors/${workflowProcessor.id}`] } },
  );
  view.queryClient.setQueryData(['processor', workflowProcessor.id], workflowProcessor);
  return view;
};

describe('Processor page', () => {
  describe('when a cached workflow processor fails to refetch', () => {
    it('shows the expired session instead of redirecting to the workflow', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/processors/${workflowProcessor.id}`, () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );
      renderProcessorWithCachedWorkflow();

      expect(await screen.findByText('Session Expired')).not.toBeNull();
      expect(screen.queryByText('Workflow graph')).toBeNull();
    });

    it('shows the permission error instead of redirecting to the workflow', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/processors/${workflowProcessor.id}`, () =>
          HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
        ),
      );
      renderProcessorWithCachedWorkflow();

      expect(await screen.findByText('Permission Denied')).not.toBeNull();
      expect(screen.queryByText('Workflow graph')).toBeNull();
    });
  });

  describe('when the processor is a workflow', () => {
    it('opens the workflow graph', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/processors/${workflowProcessor.id}`, () => HttpResponse.json(workflowProcessor)),
      );
      renderWithProviders(
        <Routes>
          <Route path="/processors/:processorId" element={<Processor />} />
          <Route path="/workflows/:workflowId/graph" element={<p>Workflow graph</p>} />
        </Routes>,
        { router: { initialEntries: [`/processors/${workflowProcessor.id}`] } },
      );

      expect(await screen.findByText('Workflow graph')).not.toBeNull();
    });
  });
});
