import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import WorkflowSchedules from '..';
import { WORKFLOW_ID, weatherWorkflowSchedules } from './fixtures/schedules';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderPage = () =>
  renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route path="/workflows/:workflowId/schedules" element={<WorkflowSchedules />} />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: [`/workflows/${WORKFLOW_ID}/schedules`] } },
  );

describe('WorkflowSchedules page', () => {
  describe('when schedules exist for the workflow', () => {
    const renderWithSchedules = () => {
      const onList = vi.fn<(workflowId: string | null) => void>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/schedules`, ({ request }) => {
          onList(new URL(request.url).searchParams.get('workflowId'));
          return HttpResponse.json(weatherWorkflowSchedules);
        }),
      );
      const result = renderPage();
      return { ...result, onList };
    };

    it('requests only the schedules of that workflow', async () => {
      const { onList } = renderWithSchedules();

      await waitFor(() => expect(onList).toHaveBeenCalledWith(WORKFLOW_ID));
    });

    it('renders the schedule rows', async () => {
      renderWithSchedules();

      expect(await screen.findByText('sched-weather')).not.toBeNull();
    });

    it('renders inside a padded page body, matching the global schedules page', async () => {
      const { container } = renderWithSchedules();

      await screen.findByText('sched-weather');
      const main = container.querySelector('[data-slot="page-layout"] > main');
      expect(main?.className).toContain('p-4');
    });
  });
});
