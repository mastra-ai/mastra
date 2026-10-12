import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowNavigation } from '../workflow-navigation';
import { WORKFLOW_ID, weatherWorkflow } from '@/domains/workflows/__tests__/fixtures/workflow';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/workflows`, () =>
      HttpResponse.json({ [WORKFLOW_ID]: { ...weatherWorkflow, name: 'Weather report' } }),
    ),
  );
});

describe('WorkflowNavigation', () => {
  describe('when the workflow ID is copied from the header', () => {
    it('copies the id used in code, not the display name', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      renderWithProviders(
        <TestLinkProvider>
          <Routes>
            <Route path="/workflows/:workflowId/graph" element={<WorkflowNavigation />} />
          </Routes>
        </TestLinkProvider>,
        { router: { initialEntries: [`/workflows/${WORKFLOW_ID}/graph`] } },
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Copy workflow ID' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(WORKFLOW_ID));
    });
  });
});
