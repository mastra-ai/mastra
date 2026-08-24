import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryDecisionSummary } from '../domains/factory/services/decisions';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';

const proposedDecision: FactoryDecisionSummary = {
  id: 'decision-1',
  evaluationId: 'evaluation-1',
  workItemId: 'item-1',
  type: 'invokeSkill',
  role: 'plan',
  status: 'proposed',
  attempts: 0,
  lastError: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  completedAt: null,
  failureOccurrence: 0,
  failureCode: null,
  canRetry: false,
};

function renderRulesPage(onDecisionRequest: (statuses: string | null) => void) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${FACTORY_ID}/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, ({ request }) => {
      const statuses = new URL(request.url).searchParams.get('statuses');
      onDecisionRequest(statuses);
      return HttpResponse.json({ decisions: statuses === 'proposed' || statuses === null ? [proposedDecision] : [] });
    }),
  );

  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/rules`] });
  renderWithProviders(<RouterProvider router={router} />);
}

describe('Rules page filters', () => {
  it('filters rule decisions with the mobile select', async () => {
    const statuses: Array<string | null> = [];
    const onDecisionRequest = vi.fn((status: string | null) => statuses.push(status));
    const user = userEvent.setup();
    renderRulesPage(onDecisionRequest);

    expect(await screen.findByText('invokeSkill')).toBeVisible();

    await user.click(screen.getByRole('combobox', { name: 'Rule decision filter' }));
    await user.click(await screen.findByRole('option', { name: 'Awaiting approval' }));

    expect(await screen.findByRole('combobox', { name: 'Rule decision filter' })).toHaveTextContent(
      'Awaiting approval',
    );
    expect(onDecisionRequest).toHaveBeenCalled();
    expect(statuses).toContain('proposed');
  });
});
