import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import type { IntakeRefreshResponse } from '../../../../../api/types';
import { RefreshIntakeButton } from '../RefreshIntakeButton';

const FACTORY_ID = 'factory 1';
const REFRESH_URL = `${TEST_BASE_URL}/web/factory/projects/factory%201/intake/refresh`;

function summary(
  fields: Partial<Extract<IntakeRefreshResponse['integrations'][number], { status: 'refreshed' }>['summary']> = {},
) {
  return { checked: 0, updated: 0, closed: 0, observed: 0, failed: 0, ...fields };
}

function serveRefresh(response: IntakeRefreshResponse) {
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let calls = 0;
  server.use(
    http.post(REFRESH_URL, async () => {
      calls += 1;
      await released;
      return HttpResponse.json(response);
    }),
  );
  return { release, calls: () => calls };
}

function renderButton() {
  return renderWithProviders(
    <>
      <RefreshIntakeButton factoryId={FACTORY_ID} />
      <Toaster />
    </>,
  );
}

describe('Refresh intake', () => {
  it("reconciles the project's intake sources, then re-reads the board's cards", async () => {
    const refresh = serveRefresh({
      integrations: [
        { integrationId: 'jira', status: 'refreshed', summary: summary({ checked: 3, updated: 1 }) },
        { integrationId: 'github', status: 'refreshed', summary: summary({ checked: 2, observed: 1 }) },
      ],
    });
    const { client } = renderButton();
    client.setQueryData([...queryKeys.workItems(FACTORY_ID), 'phases', 'work'], { cards: [] });

    const button = screen.getByRole('button', { name: 'Refresh intake' });
    await userEvent.click(button);

    // One refresh at a time: the button holds until every integration has finished.
    await waitFor(() => expect(button).toBeDisabled());
    await userEvent.click(button);
    expect(refresh.calls()).toBe(1);

    refresh.release();
    expect(await screen.findByText('Intake refreshed')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(button).toBeEnabled();
    expect(client.getQueryState([...queryKeys.workItems(FACTORY_ID), 'phases', 'work'])?.isInvalidated).toBe(true);
  });

  it('names the integrations that could not refresh, and the items that could not be read', async () => {
    serveRefresh({
      integrations: [
        { integrationId: 'jira', status: 'refreshed', summary: summary({ checked: 3 }) },
        { integrationId: 'linear', status: 'failed' },
        { integrationId: 'incident-io', status: 'failed' },
      ],
    }).release();
    const { client } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh intake' }));
    expect(await screen.findByText("Couldn't refresh Linear, incident.io")).toBeInTheDocument();
    await waitForMutationsIdle(client);

    serveRefresh({
      integrations: [{ integrationId: 'vanta', status: 'refreshed', summary: summary({ checked: 4, failed: 2 }) }],
    }).release();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh intake' }));
    expect(await screen.findByText("Intake refreshed, but 2 item(s) couldn't be read")).toBeInTheDocument();
  });

  it('says so when no intake source can refresh yet, and when the project was just refreshed', async () => {
    serveRefresh({ integrations: [] }).release();
    const { client } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh intake' }));
    expect(await screen.findByText('No intake source can be refreshed yet')).toBeInTheDocument();
    await waitForMutationsIdle(client);

    server.use(
      http.post(REFRESH_URL, () =>
        HttpResponse.json(
          {
            error: 'intake_refresh_too_soon',
            message: 'This project was just refreshed. Try again in a minute.',
            retryAfterSeconds: 42,
          },
          { status: 429, headers: { 'Retry-After': '42' } },
        ),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh intake' }));
    expect(await screen.findByText('This project was just refreshed. Try again in a minute.')).toBeInTheDocument();
  });
});
