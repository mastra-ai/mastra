import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import {
  settingsFactory,
  settingsMemory,
  settingsPacks,
  settingsProviders,
  settingsSession,
  settingsThinking,
} from './fixtures/settingsScopes';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const OM_URL = `${TEST_BASE_URL}/web/config/om`;

function renderSettings(section: string) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [
      { pathname: `/factories/fp-1/settings/${section}`, state: { settingsReturnTo: '/factories/fp-1/work' } },
    ],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [settingsFactory] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => HttpResponse.json({ project: settingsFactory })),
    http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, () => HttpResponse.json(settingsSession)),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/fp-1`, () => HttpResponse.json(settingsSession)),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/fp-1/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
    http.get(PROVIDERS_URL, () => HttpResponse.json(settingsProviders)),
    http.get(`${TEST_BASE_URL}/web/config/custom-providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () => HttpResponse.json(settingsPacks)),
    http.get(`${TEST_BASE_URL}/web/config/thinking`, () => HttpResponse.json(settingsThinking)),
    http.get(OM_URL, () => HttpResponse.json({ config: settingsMemory })),
  );
});

describe('Settings ownership', () => {
  it('keeps personal models separate and writes a personal key even when an org key exists', async () => {
    let keyBody: unknown;
    server.use(
      http.put(`${PROVIDERS_URL}/openai/key`, async ({ request }) => {
        keyBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings('personal-models');

    expect(await screen.findByText('Your defaults')).toBeInTheDocument();
    expect(screen.queryByText('Factory defaults')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat defaults')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom providers')).not.toBeInTheDocument();
    expect(screen.getByText(/Creating or removing a pack changes the list for your whole org/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
    expect(await screen.findByText('Covered by org')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add API key for OpenAI' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-personal');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(keyBody).toEqual({ key: 'sk-personal', scope: 'user' }));
  });

  it('keeps shared defaults in Factory models and writes organization credentials', async () => {
    let keyBody: unknown;
    server.use(
      http.put(`${PROVIDERS_URL}/openai/key`, async ({ request }) => {
        keyBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings('models');

    expect(await screen.findByText('Factory defaults')).toBeInTheDocument();
    expect(screen.getByText('Chat defaults')).toBeInTheDocument();
    expect(screen.getByText('Thinking defaults')).toBeInTheDocument();
    expect(screen.queryByText('Your defaults')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
    await user.click(await screen.findByRole('button', { name: 'Update key for OpenAI' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-shared');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(keyBody).toEqual({ key: 'sk-shared', scope: 'org' }));
  });

  it('lets members inspect shared provider settings and explains why edits require an admin', async () => {
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ ...settingsProviders, orgKeyAdmin: false })));
    const user = userEvent.setup();
    renderSettings('models');

    expect(await screen.findByText('Only organization admins can manage org-wide credentials.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connect with API key' }));
    expect(await screen.findByText('Key saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update key for OpenAI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove key for OpenAI' })).toBeDisabled();
  });

  it('preserves the caller memory scope when editing Your memory', async () => {
    let body: unknown;
    let requestedFactoryId: string | null | undefined;
    server.use(
      http.get(OM_URL, ({ request }) => {
        requestedFactoryId = new URL(request.url).searchParams.get('factoryId');
        return HttpResponse.json({ config: settingsMemory });
      }),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true, config: { ...settingsMemory, observationThreshold: 3000 } });
      }),
    );
    const user = userEvent.setup();
    renderSettings('memory');
    const input = await screen.findByDisplayValue('1000');
    expect(requestedFactoryId).toBeNull();
    await user.clear(input);
    await user.type(input, '3000');
    await user.tab();
    await waitFor(() => expect(body).toEqual({ resourceId: 'fp-1', observationThreshold: 3000 }));
  });

  it('preserves the Factory memory scope when navigating from Your memory', async () => {
    let body: unknown;
    const requestedFactoryIds: Array<string | null> = [];
    server.use(
      http.get(OM_URL, ({ request }) => {
        requestedFactoryIds.push(new URL(request.url).searchParams.get('factoryId'));
        return HttpResponse.json({ config: settingsMemory });
      }),
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true, config: { ...settingsMemory, observationThreshold: 4000 } });
      }),
    );
    const user = userEvent.setup();
    renderSettings('memory');
    await screen.findByDisplayValue('1000');
    await user.click(screen.getByRole('link', { name: 'Factory memory' }));
    const input = await screen.findByDisplayValue('1000');
    await waitFor(() => expect(requestedFactoryIds).toContain('fp-1'));
    expect(screen.queryByRole('group', { name: 'Who these settings apply to' })).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '4000');
    await user.tab();
    await waitFor(() => expect(body).toEqual({ factoryId: 'fp-1', observationThreshold: 4000 }));
  });

  it('keeps old model-pack deep links working with the return location and hash', async () => {
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [
        {
          pathname: '/factories/fp-1/settings/models',
          hash: '#model-packs',
          search: '?from=chat',
          state: { settingsReturnTo: '/factories/fp-1/work' },
        },
      ],
    });
    renderWithProviders(<RouterProvider router={router} />);
    expect(await screen.findByText('Your defaults')).toBeInTheDocument();
    expect(router.state.location).toMatchObject({
      pathname: '/factories/fp-1/settings/personal-models',
      hash: '#model-packs',
      search: '?from=chat',
      state: { settingsReturnTo: '/factories/fp-1/work' },
    });
    const personal = screen.getByRole('region', { name: 'Your settings' });
    expect(within(personal).getByRole('link', { name: 'Your models' })).toHaveAttribute('aria-current', 'page');
  });
});
