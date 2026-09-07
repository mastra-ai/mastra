/**
 * The Supervisor page binds the chat to the factory's deterministic supervisor
 * session (no stored session row, no sandbox) and keeps health-check
 * findings in a chat-style side panel. "Ask supervisor" hands a finding to the composer.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { FactoryHealthReport } from '../../domains/supervisor/services/supervisor';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const SUPERVISOR_ID = `factory-supervisor:${FACTORY_ID}`;
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

function report(findings: FactoryHealthReport['findings']): FactoryHealthReport {
  const counts = {
    'decision-failed': 0,
    'decision-stuck': 0,
    'start-stalled': 0,
    'seat-orphaned': 0,
    'seat-missing': 0,
    'proposal-waiting': 0,
    'held-waiting': 0,
    'label-drift': 0,
  };
  for (const finding of findings) counts[finding.kind] += 1;
  return { checkedAt: '2026-09-03T00:00:00.000Z', findings, counts };
}

function stubSupervisorRoute(health: FactoryHealthReport) {
  const sessionCreates: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/supervisor/health`, () => HttpResponse.json(health)),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.post(`${AC}/sessions`, async ({ request }) => {
      const body = (await request.json()) as { resourceId?: string };
      sessionCreates.push(body.resourceId ?? '');
      return HttpResponse.json({ controllerId: 'code', resourceId: SUPERVISOR_ID, threadId: SUPERVISOR_ID });
    }),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SUPERVISOR_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SUPERVISOR_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [{ id: SUPERVISOR_ID }] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
  );
  return { sessionCreates };
}

function renderSupervisor(search = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/supervisor${search}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('SupervisorPage', () => {
  describe('when the factory has no health findings', () => {
    it('binds the chat to the deterministic supervisor session without a stored session row', async () => {
      const { sessionCreates } = stubSupervisorRoute(report([]));
      renderSupervisor();

      expect(await screen.findByRole('region', { name: 'Supervisor composer' })).toBeInTheDocument();
      const header = screen.getByRole('region', { name: 'Supervisor session' });
      expect(within(header).getByRole('link', { name: 'Acme Factory' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/overview`,
      );
      expect(within(header).getByText('Supervisor')).toBeInTheDocument();
      await waitFor(() => expect(sessionCreates).toContain(SUPERVISOR_ID));
    });

    it('shows a healthy state in the findings panel', async () => {
      stubSupervisorRoute(report([]));
      renderSupervisor();

      await userEvent.click(await screen.findByRole('button', { name: 'Supervisor findings' }));

      const findings = screen.getByRole('region', { name: 'Supervisor findings' });
      expect(within(findings).getByText(/No findings/)).toBeInTheDocument();
    });
  });

  describe('when failed decision findings are available', () => {
    it('keeps the panel bounded and links to the complete Attention inbox', async () => {
      stubSupervisorRoute(
        report(
          Array.from({ length: 6 }, (_, index) => ({
            kind: 'decision-failed' as const,
            id: `dec-${index + 1}`,
            workItemId: `wi-${index + 1}`,
            workItemNumber: 22874 + index,
            title: `Failed decision ${index + 1}`,
            evidence: 'The decision exhausted its retry attempts.',
            ageMs: 3_600_000,
            suggestedRepair: { action: 'retry-decision' as const, decisionId: `dec-${index + 1}` },
          })),
        ),
      );
      renderSupervisor();

      await userEvent.click(await screen.findByRole('button', { name: 'Supervisor findings' }));
      const findings = screen.getByRole('region', { name: 'Supervisor findings' });
      await userEvent.click(within(findings).getByRole('button', { name: /Failed decisions/ }));

      expect(within(findings).getByText('Failed decision 5')).toBeInTheDocument();
      expect(within(findings).queryByText('Failed decision 6')).not.toBeInTheDocument();
      expect(within(findings).getByRole('link', { name: 'View all in Attention' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/attention`,
      );
    });

    it('hands the selected finding to the supervisor composer', async () => {
      stubSupervisorRoute(
        report([
          {
            kind: 'decision-failed',
            id: 'dec-1',
            workItemId: 'wi-1',
            workItemNumber: 22874,
            title: 'Plan step could not start',
            evidence: 'invokeSkill plan failed after 5 attempts: No active Factory binding for role plan.',
            ageMs: 3_600_000,
            suggestedRepair: { action: 'retry-decision', decisionId: 'dec-1' },
          },
        ]),
      );
      renderSupervisor();

      await userEvent.click(await screen.findByRole('button', { name: 'Supervisor findings' }));
      const findings = screen.getByRole('region', { name: 'Supervisor findings' });
      await userEvent.click(within(findings).getByRole('button', { name: /Failed decisions/ }));
      await userEvent.click(within(findings).getByRole('button', { name: 'Ask supervisor' }));

      const composer = screen.getByRole('region', { name: 'Supervisor composer' });
      await waitFor(() =>
        expect(within(composer).getByRole<HTMLTextAreaElement>('textbox').value).toContain('#22874 (dec-1)'),
      );
    });
  });

  describe('when the page is opened from an Ask supervisor deep link', () => {
    it('prefills the composer with the linked question', async () => {
      stubSupervisorRoute(report([]));
      renderSupervisor('?ask=Why%20is%20%2322874%20red%3F');

      const composer = await screen.findByRole('region', { name: 'Supervisor composer' });
      await waitFor(() => expect(within(composer).getByRole('textbox')).toHaveValue('Why is #22874 red?'));
    });
  });
});
