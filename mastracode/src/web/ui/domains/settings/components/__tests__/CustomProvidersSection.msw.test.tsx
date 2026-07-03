import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { CustomProviderInfo } from '../../../../../../shared/api/types';
import { CustomProvidersSection } from '../CustomProvidersSection';

const LIST_URL = `${TEST_BASE_URL}/api/web/config/custom-providers`;
const itemUrl = (id: string) => `${LIST_URL}/${encodeURIComponent(id)}`;

function listResponse(providers: CustomProviderInfo[]) {
  return HttpResponse.json({ providers });
}

const myLlm: CustomProviderInfo = {
  id: 'my-llm',
  name: 'my-llm',
  url: 'https://api.example.com/v1',
  hasApiKey: true,
  models: ['model-a', 'model-b'],
};

describe('CustomProvidersSection', () => {
  describe('when providers load', () => {
    it('renders the configured providers', async () => {
      server.use(http.get(LIST_URL, () => listResponse([myLlm])));

      renderWithProviders(<CustomProvidersSection />);

      expect(await screen.findByText('my-llm')).toBeInTheDocument();
      expect(screen.getByText('https://api.example.com/v1')).toBeInTheDocument();
    });
  });

  describe('when the list is empty', () => {
    it('shows the empty state', async () => {
      server.use(http.get(LIST_URL, () => listResponse([])));

      renderWithProviders(<CustomProvidersSection />);

      expect(await screen.findByText(/No custom providers yet/)).toBeInTheDocument();
    });
  });

  describe('when a provider is added', () => {
    it('POSTs the draft and refetches so the new provider appears', async () => {
      const providers: CustomProviderInfo[] = [];
      let postBody: unknown;
      server.use(
        http.get(LIST_URL, () => listResponse(providers)),
        http.post(LIST_URL, async ({ request }) => {
          postBody = await request.json();
          providers.push(myLlm);
          return HttpResponse.json({ ok: true, provider: myLlm });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<CustomProvidersSection />);

      await user.click(await screen.findByRole('button', { name: 'Add provider' }));
      await user.type(screen.getByPlaceholderText('e.g. my-llm'), 'my-llm');
      await user.type(screen.getByPlaceholderText('https://api.example.com/v1'), 'https://api.example.com/v1');
      await user.type(screen.getByPlaceholderText('model-a, model-b'), 'model-a, model-b');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() =>
        expect(postBody).toEqual({
          name: 'my-llm',
          url: 'https://api.example.com/v1',
          models: ['model-a', 'model-b'],
        }),
      );
      expect(await screen.findByText('my-llm')).toBeInTheDocument();
    });
  });

  describe('when a save fails', () => {
    it('surfaces the server error message', async () => {
      server.use(
        http.get(LIST_URL, () => listResponse([])),
        http.post(LIST_URL, () => HttpResponse.json({ error: 'bad url' }, { status: 400 })),
      );

      const user = userEvent.setup();
      renderWithProviders(<CustomProvidersSection />);

      await user.click(await screen.findByRole('button', { name: 'Add provider' }));
      await user.type(screen.getByPlaceholderText('e.g. my-llm'), 'my-llm');
      await user.type(screen.getByPlaceholderText('https://api.example.com/v1'), 'bad');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByText('bad url')).toBeInTheDocument();
    });
  });

  describe('when a provider is removed', () => {
    it('DELETEs it and refetches so it drops out of the list', async () => {
      const providers: CustomProviderInfo[] = [myLlm];
      let removed = false;
      server.use(
        http.get(LIST_URL, () => listResponse(providers)),
        http.delete(itemUrl('my-llm'), () => {
          removed = true;
          providers.length = 0;
          return HttpResponse.json({ ok: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<CustomProvidersSection />);

      const row = (await screen.findByText('my-llm')).closest('[role="listitem"]') as HTMLElement;
      await user.click(within(row).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(removed).toBe(true));
      await waitFor(() => expect(screen.queryByText('my-llm')).not.toBeInTheDocument());
    });
  });
});
