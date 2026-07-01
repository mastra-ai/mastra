import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../e2e/web-ui/render';
import type { ProviderInfo } from '../../shared/api/types';
import { ProvidersSection } from './ProvidersSection';

const PROVIDERS_URL = `${TEST_BASE_URL}/web/config/providers`;
const keyUrl = (provider: string) => `${PROVIDERS_URL}/${encodeURIComponent(provider)}/key`;

function providersResponse(providers: ProviderInfo[]) {
  return HttpResponse.json({ providers });
}

describe('ProvidersSection', () => {
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
      const row = (await screen.findByText('openai')).closest('.provider-row') as HTMLElement;

      await user.click(within(row).getByRole('button', { name: 'Add key' }));
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(putBody).toEqual({ key: 'sk-test' }));
      await waitFor(() => expect(within(row).getByText('Key saved')).toBeInTheDocument());
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

      const row = (await screen.findByText('openai')).closest('.provider-row') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('openai')).not.toBeInTheDocument());
    });
  });
});
