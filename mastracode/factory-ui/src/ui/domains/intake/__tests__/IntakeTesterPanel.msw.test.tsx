import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders, renderWithProviders } from '../../../../../e2e/ui/render';
import type { IntakeDryRunResponse, IntakeTestResponse } from '../../../../api/types';
import { useIntakeDryRunQuery } from '../../../../hooks/useIntakeDryRun';
import { useIntakeRouteWrites } from '../../../../hooks/useIntakeRoutes';
import { IntakeTesterPanel } from '../IntakeTesterPanel';

const PROJECT = `${TEST_BASE_URL}/web/factory/projects/fp-1`;
const ITEM_ID = '0b9a4c1e-5f2d-4c3a-9e8b-7d6f5a4b3c2d';

const shipped: IntakeTestResponse = {
  item: { title: 'Crash on start', url: 'https://github.com/mastra-ai/mastra/issues/12', kind: 'fetched', id: null },
  placement: { boardKey: 'work', routeId: 'everything', phase: 'intake' },
  reason: null,
  boards: [
    {
      boardKey: 'ship',
      name: 'Ship',
      rules: [
        {
          routeId: 'ship-bugs',
          name: 'Bugs from mastra-ai/ship',
          phase: 'intake',
          outcome: 'no_match',
          failed: [
            { field: 'source.repository', operator: 'equals', value: 'mastra-ai/ship', actual: 'mastra-ai/mastra' },
          ],
        },
        {
          routeId: 'ship-label',
          name: 'Labelled ship',
          phase: 'intake',
          outcome: 'no_match',
          failed: [{ field: 'item.labels', operator: 'contains', value: 'ship', actual: ['bug'] }],
        },
      ],
    },
    {
      boardKey: 'work',
      name: 'Work',
      rules: [
        { routeId: 'everything', name: 'Everything else', phase: 'intake', outcome: 'took' },
        {
          routeId: 'late',
          name: null,
          phase: 'intake',
          outcome: 'lost',
          to: { boardKey: 'work', routeId: 'everything' },
        },
      ],
    },
  ],
};

function serveTest(response: IntakeTestResponse | { status: number; error: string; message: string }) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${PROJECT}/intake/test`, async ({ request }) => {
      bodies.push(await request.json());
      if ('status' in response) {
        return HttpResponse.json({ error: response.error, message: response.message }, { status: response.status });
      }
      return HttpResponse.json(response);
    }),
  );
  return bodies;
}

describe('IntakeTesterPanel', () => {
  it('tests a pasted URL and shows where it goes and what every rule answered', async () => {
    const bodies = serveTest(shipped);
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Issue or pull request URL' }),
      ' https://github.com/mastra-ai/mastra/issues/12 ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));

    expect(await screen.findByText('Goes to Work › intake')).toBeTruthy();
    expect(bodies).toEqual([{ url: 'https://github.com/mastra-ai/mastra/issues/12' }]);
    const answers = within(screen.getByRole('list', { name: 'What each rule answered' }))
      .getAllByRole('listitem')
      .map(item => item.textContent);
    expect(answers).toEqual([
      'Ship › Bugs from mastra-ai/ship: no, source.repository is mastra-ai/mastra, wanted equals mastra-ai/ship',
      'Ship › Labelled ship: no, item.labels is bug, wanted contains ship',
      'Work › Everything else: yes',
      'Work › Unnamed rule: matched, but Work › Everything else took it first',
    ]);
    expect(screen.getByRole('link', { name: 'Crash on start' }).getAttribute('href')).toBe(
      'https://github.com/mastra-ai/mastra/issues/12',
    );
  });

  it('tests a recent item as soon as it opens, against unsaved order, and says why nothing takes it', async () => {
    const bodies = serveTest({
      ...shipped,
      item: { title: 'Question', url: null, kind: 'not_routed', id: ITEM_ID },
      placement: null,
      reason: "No board's intake rules match it (checked SHIP).",
      boards: shipped.boards.slice(0, 1),
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" itemId={ITEM_ID} draft={{ order: ['ship'] }} />);

    expect(await screen.findByText("Not routed. No board's intake rules match it (checked SHIP).")).toBeTruthy();
    expect(bodies).toEqual([{ order: ['ship'], itemId: ITEM_ID }]);
  });

  it("shows the server's refusal for a repository the project hasn't linked", async () => {
    serveTest({
      status: 422,
      error: 'not_linked',
      message: 'That repository is not linked to this project.',
    });
    renderWithProviders(<IntakeTesterPanel factoryProjectId="fp-1" />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Issue or pull request URL' }),
      'https://github.com/someone/else/issues/1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));

    expect(await screen.findByText('That repository is not linked to this project.')).toBeTruthy();
  });
});

describe('useIntakeDryRunQuery', () => {
  it('runs the saved rules, and runs them again after a rule changes', async () => {
    const dryRun: IntakeDryRunResponse = { sampled: 0, boards: [], notRouted: [], items: [], canEdit: true };
    const bodies: unknown[] = [];
    server.use(
      http.post(`${PROJECT}/intake/dry-run`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(dryRun);
      }),
      http.get(`${PROJECT}/intake-routes`, () => HttpResponse.json({ intakeRoutes: [], canEdit: true })),
      http.post(`${PROJECT}/intake-routes/reorder`, () => HttpResponse.json({ intakeRoutes: [] })),
    );
    const { result } = renderHookWithProviders(() => ({
      dryRun: useIntakeDryRunQuery('fp-1'),
      writes: useIntakeRouteWrites('fp-1'),
    }));

    await waitFor(() => expect(result.current.dryRun.data).toEqual(dryRun));
    expect(bodies).toEqual([{}]);
    await act(() => result.current.writes.mutateAsync([{ kind: 'reorder', ids: [] }]));
    await waitFor(() => expect(bodies).toHaveLength(2));
  });
});
