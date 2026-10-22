import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
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

function renderSettings(section: string, hash = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [
      { pathname: `/factories/fp-1/settings/${section}`, hash, state: { settingsReturnTo: '/factories/fp-1/work' } },
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

const region = (name: string) => screen.getByRole('region', { name });

describe('Settings ownership', () => {
  it('collapses personal defaults in a Factory-routed Factory and writes organization credentials', async () => {
    let keyBody: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { ...settingsFactory, modelScope: 'factory' } }),
      ),
      http.put(`${PROVIDERS_URL}/openai/key`, async ({ request }) => {
        keyBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderSettings('models');

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Factory' })).toBeChecked());
    expect(within(region('Personal defaults')).getByText('Not used in this scope')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Thinking: Medium' })).toBeInTheDocument();
    const factoryDefaults = region('Factory defaults');
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

  it('lets members inspect Factory credentials and explains why edits require an admin', async () => {
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ ...settingsProviders, orgKeyAdmin: false })));
    renderSettings('models');

    const factoryDefaults = await screen.findByRole('region', { name: 'Factory defaults' });
    expect(
      await within(factoryDefaults).findByText('Only organization admins can manage org-wide credentials.'),
    ).toBeInTheDocument();
    expect(within(factoryDefaults).getByText('Key saved')).toBeInTheDocument();
    expect(within(factoryDefaults).getByRole('button', { name: 'OpenAI actions' })).toBeDisabled();
    expect(within(factoryDefaults).getByRole('button', { name: 'Add provider' })).toBeDisabled();
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
      const input = await within(card).findByRole('textbox', { name: 'Messages before observation' });
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
    { retired: { pathname: '/factories/fp-1/settings/personal-models' }, hash: '#personal-defaults' },
    { retired: { pathname: '/factories/fp-1/settings/models', hash: '#model-packs' }, hash: '#personal-defaults' },
  ])(
    'sends $retired.pathname$retired.hash to Models $hash, keeping search and return state',
    async ({ retired, hash }) => {
      const router = createMemoryRouter(createAppRoutes(), {
        initialEntries: [{ ...retired, search: '?from=chat', state: { settingsReturnTo: '/factories/fp-1/work' } }],
      });
      renderWithProviders(<RouterProvider router={router} />);

      expect(await screen.findByRole('region', { name: 'Personal defaults' })).toBeInTheDocument();
      expect(router.state.location).toMatchObject({
        pathname: '/factories/fp-1/settings/models',
        hash,
        search: '?from=chat',
        state: { settingsReturnTo: '/factories/fp-1/work' },
      });
      expect(screen.getByRole('link', { name: 'Models' })).toHaveAttribute('aria-current', 'page');
    },
  );

  it('sends retired Factory memory links to Memory', async () => {
    const router = renderSettings('factory-memory');

    expect(await screen.findByRole('region', { name: 'Factory memory' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/fp-1/settings/memory');
    expect(screen.getByRole('link', { name: 'Memory' })).toHaveAttribute('aria-current', 'page');
  });

  it('scrolls a cold-loaded defaults link to its card once the card renders', async () => {
    const scrolledIds: string[] = [];
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledIds.push(this.id);
    };
    onTestFinished(() => {
      Element.prototype.scrollIntoView = scrollIntoView;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { ...settingsFactory, modelScope: 'factory' } }),
      ),
    );

    renderSettings('models', '#factory-defaults');

    expect(await screen.findByRole('region', { name: 'Factory defaults' })).toBeInTheDocument();
    await waitFor(() => expect(scrolledIds).toEqual(['factory-defaults']));
  });
});
