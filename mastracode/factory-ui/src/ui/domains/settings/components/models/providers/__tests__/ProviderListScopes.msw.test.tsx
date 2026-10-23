import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../../../api/types';
import { ProviderList } from '../ProviderList';
import {
  PROVIDERS_URL,
  keyUrl,
  oauthUrl,
  openAddProvider,
  pasteCodeSession,
  pickRowAction,
  rowFor,
  saveKey,
  stubProviders,
} from './provider-list-test-utils';

const ORG_SHARED_CAPTION = 'Shared with every Factory in your organization.';

function enableAuth() {
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
    ),
  );
}

function renderBothLists() {
  renderWithProviders(
    <>
      <section aria-label="Personal">
        <ProviderList credentialScope="user" />
      </section>
      <section aria-label="Factory">
        <ProviderList credentialScope="org" />
      </section>
    </>,
  );
  return {
    personal: () => screen.getByRole('region', { name: 'Personal' }),
    factory: () => screen.getByRole('region', { name: 'Factory' }),
  };
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('ProviderList credential scopes', () => {
  describe('with auth enabled', () => {
    beforeEach(enableAuth);

    it.each(['personal', 'factory'] as const)(
      'lists a deployment provider in the %s list as read-only, since every scope can run its models',
      async list => {
        stubProviders([
          { provider: 'amazon-bedrock', source: 'deployment' },
          { provider: 'openai', source: 'none' },
        ]);
        const lists = renderBothLists();

        const row = await waitFor(() => rowFor('amazon-bedrock', lists[list]()));
        expect(within(row).getByText('From deployment')).toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: 'Amazon Bedrock actions' })).not.toBeInTheDocument();
      },
    );

    it('saves an org key from the Factory list and keeps it out of the personal list', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none' }];
      let putBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          providers[0] = { provider: 'openai', source: 'stored-org', orgKey: true, orgCredential: 'api_key' };
          return HttpResponse.json({ ok: true });
        }),
      );
      const user = userEvent.setup();
      const lists = renderBothLists();

      const dialog = await openAddProvider(user, lists.factory());
      expect(dialog).toHaveTextContent('Everyone in your organization can use it.');
      await user.type(within(dialog).getByLabelText('Search providers'), 'openai');
      await user.click(within(dialog).getByRole('button', { name: 'Add API key for OpenAI' }));
      expect(screen.queryByRole('radiogroup', { name: 'API key access' })).not.toBeInTheDocument();
      await saveKey(user, 'sk-org');

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-org', scope: 'org' }));
      await waitFor(() => expect(within(rowFor('openai', lists.factory())).getByText('Key saved')).toBeInTheDocument());
      expect(within(lists.personal()).queryByText('OpenAI')).not.toBeInTheDocument();
    });

    it('starts a personal sign-in at user scope while the org is already signed in', async () => {
      let startBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () =>
          HttpResponse.json({
            providers: [
              {
                provider: 'anthropic',
                source: 'oauth-org',
                orgCredential: 'oauth',
                oauth: { supported: true, modes: ['paste-code'] },
              },
            ],
          }),
        ),
        http.post(oauthUrl('anthropic', 'start'), async ({ request }) => {
          startBody = await request.json();
          return HttpResponse.json(pasteCodeSession('session-personal'));
        }),
      );
      const user = userEvent.setup();
      const lists = renderBothLists();

      await waitFor(() => expect(within(lists.factory()).getByText('Anthropic')).toBeInTheDocument());
      expect(within(lists.personal()).queryByText('Anthropic')).not.toBeInTheDocument();

      const dialog = await openAddProvider(user, lists.personal());
      expect(dialog).toHaveTextContent('Only you can use it.');
      await user.click(within(dialog).getByRole('button', { name: 'Sign in to Anthropic' }));

      await waitFor(() => expect(startBody).toEqual({ mode: 'paste-code', scope: 'user' }));
    });

    it('starts an org sign-in at org scope from the Factory list', async () => {
      let startBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () =>
          HttpResponse.json({
            providers: [{ provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } }],
          }),
        ),
        http.post(oauthUrl('anthropic', 'start'), async ({ request }) => {
          startBody = await request.json();
          return HttpResponse.json(pasteCodeSession('session-org'));
        }),
      );
      const user = userEvent.setup();
      const lists = renderBothLists();

      expect(await within(lists.factory()).findByText(ORG_SHARED_CAPTION)).toBeInTheDocument();
      const dialog = await openAddProvider(user, lists.factory());
      await user.click(within(dialog).getByRole('button', { name: 'Sign in to Anthropic' }));

      await waitFor(() => expect(startBody).toEqual({ mode: 'paste-code', scope: 'org' }));
    });

    it('signs out of an org sign-in at org scope from the Factory list', async () => {
      let signOutScope: string | null = null;
      server.use(
        http.get(PROVIDERS_URL, () =>
          HttpResponse.json({
            providers: [
              {
                provider: 'anthropic',
                source: 'oauth-org',
                orgKey: true,
                orgCredential: 'oauth',
                oauth: { supported: true, modes: ['paste-code'] },
              },
            ],
          }),
        ),
        http.delete(`${PROVIDERS_URL}/anthropic/oauth`, ({ request }) => {
          signOutScope = new URL(request.url).searchParams.get('scope');
          return HttpResponse.json({ ok: true });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderWithProviders(<ProviderList credentialScope="org" />);

      await screen.findByText('Anthropic');
      await pickRowAction(user, 'anthropic', 'Sign out');

      await waitForMutationsIdle(client);
      expect(signOutScope).toBe('org');
    });

    it('shows members the Factory list read-only with the reason', async () => {
      stubProviders(
        [
          {
            provider: 'anthropic',
            source: 'oauth-org',
            orgKey: true,
            orgCredential: 'oauth',
            oauth: { supported: true, modes: ['paste-code'] },
          },
        ],
        false,
      );
      const lists = renderBothLists();

      expect(
        await within(lists.factory()).findByText('Only organization admins can manage org-wide credentials.'),
      ).toBeInTheDocument();
      expect(within(lists.factory()).queryByText(ORG_SHARED_CAPTION)).not.toBeInTheDocument();
      expect(within(lists.factory()).getByRole('button', { name: 'Add provider' })).toBeDisabled();
      expect(
        within(rowFor('anthropic', lists.factory())).getByRole('button', { name: 'Anthropic actions' }),
      ).toBeDisabled();
      expect(within(lists.personal()).getByRole('button', { name: 'Add provider' })).toBeEnabled();
    });
  });

  describe('with auth disabled', () => {
    it('manages Factory-list keys in the single local store, without a scope', async () => {
      let putBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => HttpResponse.json({ providers: [{ provider: 'openai', source: 'stored' }] })),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          return HttpResponse.json({ ok: true });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderWithProviders(<ProviderList credentialScope="org" />);

      await screen.findByText('OpenAI');
      expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument();
      await pickRowAction(user, 'openai', 'Update key');
      await saveKey(user, 'sk-local');

      await waitForMutationsIdle(client);
      expect(putBody).toEqual({ key: 'sk-local' });
    });
  });
});
