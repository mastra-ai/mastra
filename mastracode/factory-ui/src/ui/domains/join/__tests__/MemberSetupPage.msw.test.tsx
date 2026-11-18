import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../api/types';
import { createAppRoutes } from '../../../router';
import type { FactoryModelScope } from '../../workspaces/services/github';
import { chooseProvider } from '../../workspaces/components/__tests__/fixtures/modelSection';

const providersUrl = `${TEST_BASE_URL}/web/config/providers`;

/**
 * A member of an organization whose Factory bills sessions to people. Each piece of their state is a variable the
 * handlers read, so a write (a saved key, a saved default) shows up on the next fetch the way the server would.
 */
function stubMember({
  modelScope = 'hybrid',
  personalKey = false,
  personalDefault = null,
  slackLinked = false,
  canConnectSlack = true,
}: {
  modelScope?: FactoryModelScope;
  personalKey?: boolean;
  personalDefault?: string | null;
  slackLinked?: boolean;
  canConnectSlack?: boolean;
} = {}) {
  const state = { personalKey, personalDefault, keyWrites: [] as unknown[] };
  const project = { id: 'fp-1', name: 'Shipyard', modelScope, defaultModelId: 'anthropic/claude-opus-5-5' };
  const openai = (): ProviderInfo => ({
    provider: 'openai',
    source: state.personalKey ? 'stored-user' : 'none',
    envVar: 'OPENAI_API_KEY',
    ...(state.personalKey ? { userCredential: 'api_key' as const } : {}),
  });
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authenticated: true,
        authEnabled: true,
        user: { userId: 'user-ward', email: 'ward@example.com', name: 'Ward' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ ...project, repositories: [] }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () => HttpResponse.json({ project })),
    http.get(providersUrl, () =>
      HttpResponse.json({
        orgKeyAdmin: false,
        providers: [{ provider: 'anthropic', source: 'stored-org', orgKey: true, orgCredential: 'api_key' }, openai()],
      }),
    ),
    http.put(`${providersUrl}/openai/key`, async ({ request }) => {
      state.keyWrites.push(await request.json());
      state.personalKey = true;
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
      const personal = new URL(request.url).searchParams.get('scope') === 'user';
      if (personal && !state.personalKey) return HttpResponse.json({ models: [], fallbackModelId: null });
      return HttpResponse.json({
        models: [{ id: 'openai/gpt-5.5', provider: 'openai', modelName: 'gpt-5.5', hasApiKey: true }],
        fallbackModelId: personal ? 'openai/gpt-5.5' : null,
      });
    }),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: state.personalDefault, thinkingLevel: null }),
    ),
    http.put<never, { modelId: string }>(`${TEST_BASE_URL}/web/config/default-model`, async ({ request }) => {
      state.personalDefault = (await request.json()).modelId;
      return HttpResponse.json({ ok: true, modelId: state.personalDefault });
    }),
    http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
      HttpResponse.json({
        canConnect: canConnectSlack,
        accounts: slackLinked
          ? [
              {
                platform: 'slack',
                externalTeamId: 'T-1',
                externalUserId: 'U-1',
                externalTeamName: 'Kepler',
                externalUserName: 'ward',
                linkedAt: '2026-11-17T23:50:00.000Z',
              },
            ]
          : [],
      }),
    ),
  );
  return state;
}

function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Member setup', () => {
  it('walks a member with nothing connected from their own model to Slack to done', async () => {
    const state = stubMember();
    const user = userEvent.setup();

    renderAt('/factories/fp-1/setup');

    expect(await screen.findByRole('heading', { name: 'Welcome to Shipyard' })).toBeInTheDocument();
    expect(screen.getByText(/Board work runs on the company account/)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();

    await chooseProvider(user, 'OpenAI');
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-member');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    // The key is the member's own; the lane stays put until they confirm, even though the server now has a model.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    expect(state.keyWrites).toEqual([{ key: 'sk-member', envVar: 'OPENAI_API_KEY', scope: 'user' }]);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(state.personalDefault).toBe('openai/gpt-5.5'));
    expect(await screen.findByRole('region', { name: 'Model' })).toHaveTextContent('openai/gpt-5.5');
    expect(screen.getByRole('button', { name: 'Sign in with Slack' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(await screen.findByRole('heading', { name: "You're all set" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a session' })).toHaveAttribute('href', '/factories/fp-1/new');
  });

  it('has nothing to ask a member of a Factory that runs everything on the company account', async () => {
    stubMember({ modelScope: 'factory', slackLinked: true });

    renderAt('/factories/fp-1/setup');

    expect(await screen.findByRole('heading', { name: "You're all set" })).toBeInTheDocument();
    expect(screen.queryByText('Your model')).not.toBeInTheDocument();
    expect(screen.getByText('@ward in Kepler')).toBeInTheDocument();
  });

  describe('coming from Slack', () => {
    it('asks for the model the Slack thread needs, then points back to the thread', async () => {
      const state = stubMember({ slackLinked: true });
      const user = userEvent.setup();

      renderAt('/factories/fp-1/setup?from=slack&slack=connected&team=T-1&channel=C-9');

      expect(await screen.findByRole('heading', { name: 'Finish setting up Slack' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Slack' })).toHaveTextContent('@ward in Kepler');

      await chooseProvider(user, 'OpenAI');
      const dialog = within(screen.getByRole('dialog'));
      await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-member');
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('heading', { name: "You're all set" })).toBeInTheDocument();
      expect(state.personalDefault).toBe('openai/gpt-5.5');
      expect(screen.getByText(/Mention the agent again in your Slack thread/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to Slack' })).toHaveAttribute(
        'href',
        'https://app.slack.com/client/T-1/C-9',
      );
    });

    it('offers Slack sign-in again when it did not finish', async () => {
      stubMember({ personalKey: true, personalDefault: 'openai/gpt-5.5' });

      renderAt('/factories/fp-1/setup?from=slack&slack=error');

      expect(await screen.findByText(/Slack sign-in didn't finish/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in with Slack' })).toBeInTheDocument();
    });
  });
});

describe('Opening a Factory with setup left', () => {
  beforeEach(() => {
    // Ambient board plumbing for the tests that land on a Factory's work board.
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions: [] })),
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
    );
  });

  it('opens setup the first time, then the board', async () => {
    stubMember();

    const first = renderAt('/factories/fp-1');
    await waitFor(() => expect(first.state.location.pathname).toBe('/factories/fp-1/setup'));
    first.dispose();

    const second = renderAt('/factories/fp-1');
    await waitFor(() => expect(second.state.location.pathname).toBe('/factories/fp-1/work'));
  });

  it('goes straight to the board when the member already has a model', async () => {
    stubMember({ personalKey: true, personalDefault: 'openai/gpt-5.5' });

    const router = renderAt('/factories/fp-1');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
  });

  it('never redirects a deep link, which shows the model step inline instead', async () => {
    stubMember();
    server.use(
      http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/fp-1/permissions`, () =>
        HttpResponse.json({ categories: {}, tools: {} }),
      ),
    );

    const router = renderAt('/factories/fp-1/new');

    expect(await screen.findByRole('heading', { name: 'Connect your model to start chatting' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/fp-1/new');
  });
});
