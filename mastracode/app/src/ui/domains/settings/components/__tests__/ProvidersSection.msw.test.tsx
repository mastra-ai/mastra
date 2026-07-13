import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderInfo } from '#shared/api/types';
import { server } from '#test/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '#test/render';

import { ProvidersSection } from '../ProvidersSection';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;
const oauthStartUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/start`;
const oauthCompleteUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/oauth/complete`;

function providersResponse(providers: ProviderInfo[], credentialManagementEnabled = true) {
  return HttpResponse.json({ credentialManagementEnabled, providers });
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  if (!(row instanceof HTMLElement)) throw new Error(`Provider row was not found: ${name}`);
  return row;
}

describe('ProvidersSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('while providers are loading', () => {
    it('renders a skeleton placeholder instead of loading text', async () => {
      server.use(
        http.get(PROVIDERS_URL, async () => {
          await delay(150);
          return providersResponse([{ provider: 'openai', source: 'stored' }]);
        }),
      );

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
      expect(screen.queryByText(/Loading providers/)).not.toBeInTheDocument();

      expect(await screen.findByText('openai')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading providers' })).not.toBeInTheDocument();
    });
  });

  describe('when providers load', () => {
    it('renders the configured providers', async () => {
      server.use(
        http.get(PROVIDERS_URL, () =>
          providersResponse([
            { provider: 'openai', source: 'stored' },
            { provider: 'anthropic', source: 'none' },
          ]),
        ),
      );

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByText('openai')).toBeInTheDocument();
      // `none`-source providers are hidden until searched.
      expect(screen.queryByText('anthropic')).not.toBeInTheDocument();
    });

    it('shows Claude subscription sign-in without requiring a provider search', async () => {
      server.use(
        http.get(PROVIDERS_URL, () =>
          providersResponse([
            {
              provider: 'anthropic',
              displayName: 'Claude Pro/Max',
              source: 'none',
              oauthSupported: true,
            },
          ]),
        ),
      );

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByText('Claude Pro/Max')).toBeInTheDocument();
      expect(screen.getByText('anthropic')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByLabelText('Search providers')).toHaveValue('');
    });

    it('keeps deployment-managed credentials read-only', async () => {
      server.use(
        http.get(PROVIDERS_URL, () =>
          providersResponse([{ provider: 'anthropic', source: 'oauth', oauthSupported: false }], false),
        ),
      );

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByText('Provider credentials are managed by this deployment.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign out|Add key|Update|Remove/ })).not.toBeInTheDocument();
    });
  });

  describe('when the list fails to load', () => {
    it('surfaces an error', async () => {
      server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

      renderWithProviders(<ProvidersSection />);

      expect(await screen.findByText('nope')).toBeInTheDocument();
    });
  });

  describe('when a key is saved', () => {
    it('PUTs the key and refetches so the provider shows as configured', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none' }];
      let putBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.put(keyUrl('openai'), async ({ request }) => {
          putBody = await request.json();
          providers[0] = { provider: 'openai', source: 'stored' };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProvidersSection />);

      // `none` providers only appear via search.
      await user.type(screen.getByLabelText('Search providers'), 'openai');
      const row = rowFor('openai');

      await user.click(within(row).getByRole('button', { name: 'Add key' }));
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-test' }));
      await waitFor(() => expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument());
    });
  });

  describe('when a stored key is removed', () => {
    it('DELETEs the key and refetches so the provider drops out of the configured list', async () => {
      const providers: ProviderInfo[] = [{ provider: 'openai', source: 'stored' }];
      let removed = false;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.delete(keyUrl('openai'), () => {
          removed = true;
          providers.length = 0;
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('openai');
      const row = rowFor('openai');
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('openai')).not.toBeInTheDocument());
    });
  });

  describe('when Claude OAuth is completed', () => {
    it('opens the provider login and refetches the signed-in provider after the code is pasted', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const providers: ProviderInfo[] = [
        {
          provider: 'anthropic',
          displayName: 'Claude Pro/Max',
          source: 'none',
          oauthSupported: true,
        },
      ];
      let completeBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.post(oauthStartUrl('anthropic'), () =>
          HttpResponse.json({
            loginId: 'login-1',
            authUrl: 'https://claude.ai/oauth',
            completionMode: 'manual-code',
          }),
        ),
        http.post(oauthCompleteUrl('anthropic'), async ({ request }) => {
          completeBody = await request.json();
          providers[0] = {
            provider: 'anthropic',
            displayName: 'Claude Pro/Max',
            source: 'oauth',
            oauthSupported: true,
          };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('anthropic');
      await user.click(within(rowFor('anthropic')).getByRole('button', { name: /Sign in/ }));

      expect(openSpy).toHaveBeenCalledWith('https://claude.ai/oauth', '_blank', 'noopener,noreferrer');

      await user.type(screen.getByPlaceholderText('Paste Claude Pro/Max code'), 'oauth-code');
      await user.click(screen.getByRole('button', { name: 'Complete' }));

      await waitFor(() => expect(completeBody).toEqual({ loginId: 'login-1', code: 'oauth-code' }));
      await waitFor(() => expect(within(rowFor('anthropic')).getByText('Signed in')).toBeInTheDocument());
    });
  });

  describe('when Codex OAuth uses a browser callback', () => {
    it('checks the completed browser sign-in without requiring a pasted code', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const providers: ProviderInfo[] = [
        {
          provider: 'openai',
          displayName: 'ChatGPT Plus/Pro',
          source: 'none',
          oauthSupported: true,
        },
      ];
      let completeBody: unknown;
      server.use(
        http.get(PROVIDERS_URL, () => providersResponse(providers)),
        http.post(oauthStartUrl('openai'), () =>
          HttpResponse.json({
            loginId: 'login-codex',
            authUrl: 'https://auth.openai.com/oauth/authorize',
            completionMode: 'browser-callback',
            instructions: 'Complete sign-in in your browser.',
          }),
        ),
        http.post(oauthCompleteUrl('openai'), async ({ request }) => {
          completeBody = await request.json();
          providers[0] = {
            provider: 'openai',
            displayName: 'ChatGPT Plus/Pro',
            source: 'oauth',
            oauthSupported: true,
          };
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<ProvidersSection />);

      await screen.findByText('openai');
      await user.click(within(rowFor('openai')).getByRole('button', { name: /Sign in/ }));

      expect(openSpy).toHaveBeenCalledWith('https://auth.openai.com/oauth/authorize', '_blank', 'noopener,noreferrer');
      expect(screen.getByText('Complete sign-in in your browser.')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Check sign-in' }));

      await waitFor(() => expect(completeBody).toEqual({ loginId: 'login-codex', code: '' }));
      await waitFor(() => expect(within(rowFor('openai')).getByText('Signed in')).toBeInTheDocument());
    });
  });
});
