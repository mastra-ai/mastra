// `.msw` suffix routes this file to the component harness — the default vitest config only collects `.test.ts`
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../../../e2e/ui/render';
import { QueueHealthPanel } from '../components/QueueHealthPanel';

const FACTORY_ID = 'factory-1';
const PROJECT_ID = 'factory-project-1';
const THRESHOLDS = [14400, 86400, 259200]; // 4h / 24h / 72h

function card(id: string, title: string, enteredAt: string) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: PROJECT_ID,
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['triage'],
    stageHistory: [{ stage: 'triage', enteredAt, by: 'user-1' }],
    sessions: { execute: { sessionId: `session-${id}`, branch: 'factory/1', threadId: 'thread-1' } },
    metadata: null,
    revision: 1,
    createdAt: enteredAt,
    updatedAt: enteredAt,
  };
}

function renderPanel(initial: ReturnType<typeof card>[]) {
  let workItems = initial;
  server.use(
    http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems })),
    http.get('*/web/factory/projects/:id/health/thresholds', () => HttpResponse.json({ thresholds: THRESHOLDS })),
  );
  const rendered = renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/overview`]}>
      <Routes>
        <Route path="/factories/:factoryId/overview" element={<QueueHealthPanel factoryProjectId={PROJECT_ID} />} />
      </Routes>
    </MemoryRouter>,
  );
  return {
    ...rendered,
    async serveWorkItems(next: ReturnType<typeof card>[]) {
      workItems = next;
      await rendered.client.invalidateQueries();
    },
  };
}

describe('QueueHealthPanel', () => {
  it('keeps the cohort tasks out of the page until a cohort is picked', async () => {
    const user = userEvent.setup();
    renderPanel([card('item-1', 'Stalled card', '2020-01-01T00:00:00.000Z')]);

    const segment = await screen.findByRole('button', { name: 'Triage Critical: 1' });
    expect(screen.queryByText('Stalled card')).not.toBeInTheDocument();

    await user.click(segment);

    expect(await screen.findByText('Stalled card')).toBeInTheDocument();
    expect(screen.getByText('1 task')).toBeInTheDocument();
  });

  it('closes the cohort tasks when a refetch empties the cohort', async () => {
    const user = userEvent.setup();
    const { serveWorkItems } = renderPanel([card('item-1', 'Stalled card', '2020-01-01T00:00:00.000Z')]);

    await user.click(await screen.findByRole('button', { name: 'Triage Critical: 1' }));
    expect(await screen.findByText('Stalled card')).toBeInTheDocument();

    await serveWorkItems([card('item-1', 'Stalled card', new Date().toISOString())]);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Triage Critical: 1' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: /Critical tasks/ })).not.toBeInTheDocument();
  });

  it('marks a card whose run is in flight', async () => {
    const running = card('item-1', 'Card being worked', '2020-01-01T00:00:00.000Z');
    running.sessions = { execute: { sessionId: 'session-1', branch: 'factory/1', threadId: 'thread-1' } };
    server.use(
      http.get('*/web/factory/projects/:id/activity', () => HttpResponse.json({ runningSessionIds: ['session-1'] })),
    );
    const user = userEvent.setup();
    renderPanel([running]);

    await user.click(await screen.findByRole('button', { name: 'Triage Critical: 1' }));

    expect(await screen.findByRole('img', { name: 'Agent running' })).toBeInTheDocument();
  });

  it('closes the cohort tasks on Escape', async () => {
    const user = userEvent.setup();
    renderPanel([card('item-1', 'Stalled card', '2020-01-01T00:00:00.000Z')]);

    await user.click(await screen.findByRole('button', { name: 'Triage Critical: 1' }));
    expect(await screen.findByText('Stalled card')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByText('Stalled card')).not.toBeInTheDocument());
  });
});
