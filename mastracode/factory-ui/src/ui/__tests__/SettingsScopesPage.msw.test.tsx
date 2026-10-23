import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryProjectPayload } from '../domains/workspaces/services/github';
import { pickModel } from '../domains/settings/components/models/defaults/__tests__/default-model-test-utils';
import { createAppRoutes } from '../router';
import {
  settingsFactory,
  settingsDefaultModel,
  settingsMemory,
  settingsProviders,
  settingsSession,
} from './fixtures/settingsScopes';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const OM_URL = `${TEST_BASE_URL}/web/config/om`;

function renderSettings(section: string, { hash = '', search = '' } = {}) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [
      {
        pathname: `/factories/fp-1/settings/${section}`,
        hash,
        search,
        state: { settingsReturnTo: '/factories/fp-1/work' },
      },
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
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json(settingsDefaultModel)),
    http.get(OM_URL, () => HttpResponse.json({ config: settingsMemory })),
  );
});

describe('Settings ownership', () => {
  it('writes organization credentials from Factory defaults', async () => {
    let keyBody: unknown;
    server.use(
      http.put(`${PROVIDERS_URL}/openai/key`, async ({ request }) => {
        keyBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings('models');

    const factoryDefaults = await screen.findByRole('region', { name: 'Factory defaults' });
    await user.click(await within(factoryDefaults).findByRole('button', { name: 'OpenAI actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Update key' }));
    await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-shared');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(keyBody).toEqual({ key: 'sk-shared', scope: 'org' }));
  });

  it('writes a personal key from personal defaults even when an org key exists', async () => {
    let keyBody: unknown;
    server.use(
      http.put(`${PROVIDERS_URL}/openai/key`, async ({ request }) => {
        keyBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings('models');

    const personalDefaults = await screen.findByRole('region', { name: 'Personal defaults' });
    expect(within(personalDefaults).queryByText('OpenAI')).not.toBeInTheDocument();
    await user.click(await within(personalDefaults).findByRole('button', { name: 'Add provider' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add provider' });
    await user.type(within(dialog).getByLabelText('Search providers'), 'openai');
    await user.click(within(dialog).getByRole('button', { name: 'Add API key for OpenAI' }));
    await user.type(await screen.findByPlaceholderText('Paste API key'), 'sk-personal');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(keyBody).toEqual({ key: 'sk-personal', scope: 'user' }));
  });

  it('saves personal memory for the caller and Factory memory for the Factory', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put(`${OM_URL}/thresholds`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ok: true, config: settingsMemory });
      }),
    );
    const user = userEvent.setup();
    renderSettings('memory');

    for (const [memory, threshold] of [
      ['Personal memory', '3000'],
      ['Factory memory', '4000'],
    ]) {
      const card = await screen.findByRole('region', { name: memory });
      const input = await within(card).findByRole('textbox', { name: 'Observe after' });
      await user.clear(input);
      await user.type(input, threshold);
      await user.tab();
    }

    await waitFor(() =>
      expect(bodies).toEqual([
        { sessionId: 'fp-1', observationThreshold: 3000 },
        { factoryId: 'fp-1', observationThreshold: 4000 },
      ]),
    );
  });

  it.each([
    { section: 'personal-models', hash: '' },
    { section: 'models', hash: '#model-packs' },
  ])('sends $section$hash to Models #personal-defaults, keeping search and return state', async ({ section, hash }) => {
    const router = renderSettings(section, { hash, search: '?from=chat' });

    expect(await screen.findByRole('region', { name: 'Personal defaults' })).toBeInTheDocument();
    expect(router.state.location).toMatchObject({
      pathname: '/factories/fp-1/settings/models',
      hash: '#personal-defaults',
      search: '?from=chat',
      state: { settingsReturnTo: '/factories/fp-1/work' },
    });
    expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute('aria-current', 'page');
  });

  it('sends retired Factory memory links to Memory', async () => {
    const router = renderSettings('factory-memory');

    expect(await screen.findByRole('region', { name: 'Factory memory' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/fp-1/settings/memory');
    expect(screen.getByRole('link', { name: 'Memory' })).toHaveAttribute('aria-current', 'page');
  });

  it('lets a Personal-routed Factory with no Factory default start chats once the user picks a personal default', async () => {
    const project: FactoryProjectPayload = { ...settingsFactory, modelScope: 'user', defaultModelId: null };
    let personalDefaultModelId: string | null = null;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => HttpResponse.json({ project })),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: personalDefaultModelId, thinkingLevel: null }),
      ),
      http.put<never, { modelId: string }>(`${TEST_BASE_URL}/web/config/default-model`, async ({ request }) => {
        personalDefaultModelId = (await request.json()).modelId;
        return HttpResponse.json({ ok: true, modelId: personalDefaultModelId });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ workItems: [] })),
      http.get(PROVIDERS_URL, () =>
        HttpResponse.json({
          ...settingsProviders,
          providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({
          models: [{ id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true }],
        }),
      ),
    );
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/factories/fp-1/new'] });
    renderWithProviders(<RouterProvider router={router} />);

    await user.click(await screen.findByRole('link', { name: 'Open Models settings' }));
    expect(router.state.location.hash).toBe('#personal-defaults');
    await pickModel(user, 'Personal default model', 'openai/gpt-5');
    await waitFor(() => expect(personalDefaultModelId).toBe('openai/gpt-5'));
    await act(() => router.navigate(-1));

    expect(await screen.findByLabelText('Message')).toBeInTheDocument();
  });
});
