import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { ProviderInfo } from '../../../../../../shared/api/types';
import { ModelProviderFactoryStep } from '../ModelProviderFactoryStep';

function registerAuthHandler() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
  );
}

function registerPersistenceHandlers(onFactoryModel: (body: unknown) => void, onOMDefaults: (body: unknown) => void) {
  server.use(
    http.patch(`${TEST_BASE_URL}/web/factory/projects/factory-1`, async ({ request }) => {
      onFactoryModel(await request.json());
      return HttpResponse.json({ project: { id: 'factory-1', name: 'Factory', defaultModelId: 'openai/gpt-5.6-sol' } });
    }),
    http.post(`${TEST_BASE_URL}/web/config/om/provider-defaults`, async ({ request }) => {
      onOMDefaults(await request.json());
      return HttpResponse.json({
        ok: true,
        config: {
          observerModelId: 'openai/gpt-5.4-mini',
          reflectorModelId: 'openai/gpt-5.4-mini',
          observationThreshold: 30000,
          reflectionThreshold: 40000,
          observeAttachments: 'auto',
        },
      });
    }),
  );
}

describe('Model provider onboarding', () => {
  describe('when the provider catalog cannot be loaded', () => {
    it('shows the request error instead of an empty provider result', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ error: 'Provider catalog unavailable' }, { status: 503 }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
      );

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Provider catalog unavailable');
      expect(screen.queryByText(/No providers match/)).not.toBeInTheDocument();
    });
  });

  describe('when the provider catalog contains sign-in and API-key providers', () => {
    it('keeps sign-in providers on top and finds API-key providers through search', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: [] } },
        { provider: 'amazon-bedrock', source: 'none' },
      ];
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      expect(await screen.findByRole('button', { name: 'Continue with Anthropic' })).toBeInTheDocument();
      // Unconnected API-key providers stay hidden until searched for.
      expect(screen.queryByRole('button', { name: 'Amazon Bedrock' })).not.toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'bedrock');

      expect(await screen.findByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      // The sign-in section is a fixed top-level section — search never hides it.
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeInTheDocument();
    });
  });

  describe('when a provider supports browser sign-in', () => {
    it('starts the OAuth flow directly from its sign-in button', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
      ];
      const onStart = vi.fn<(body: unknown) => void>();
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
        http.post(`${TEST_BASE_URL}/web/config/providers/anthropic/oauth/start`, async ({ request }) => {
          onStart(await request.json());
          return HttpResponse.json({
            sessionId: 'session-1',
            kind: 'paste-code',
            url: 'https://claude.ai/oauth/authorize',
            instructions: 'Open the link, authorize, then paste the code shown on the final page.',
            expiresAt: Date.now() + 600_000,
          });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'Continue with Anthropic' }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(onStart).toHaveBeenCalledWith({ mode: 'paste-code' });
    });
  });

  describe('when OpenAI is already connected', () => {
    it('persists the suggested Factory model and hidden OM defaults', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onOMDefaults = vi.fn<(body: unknown) => void>();
      const onComplete = vi.fn<() => void>();
      const providers: ProviderInfo[] = [
        { provider: 'openai', source: 'stored' },
        { provider: 'anthropic', source: 'none' },
      ];
      registerAuthHandler();
      registerPersistenceHandlers(onFactoryModel, onOMDefaults);
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={onComplete} />);

      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));

      // Once the provider is set, the picker gives way to a focused model
      // selection view: provider name, model field, and a Change escape hatch.
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change provider' })).toBeInTheDocument();
      expect(screen.queryByRole('searchbox', { name: 'Search model providers' })).not.toBeInTheDocument();
      expect(screen.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Finish setup' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(onFactoryModel).toHaveBeenCalledWith({ defaultModelId: 'openai/gpt-5.6-sol' });
      expect(onOMDefaults).toHaveBeenCalledWith({
        providerId: 'openai',
        factoryModelId: 'openai/gpt-5.6-sol',
      });
    });
  });

  describe('when OpenAI needs an API key', () => {
    it('keeps the provider selected and persists its defaults after connection', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onOMDefaults = vi.fn<(body: unknown) => void>();
      const onComplete = vi.fn<() => void>();
      let connected = false;
      registerAuthHandler();
      registerPersistenceHandlers(onFactoryModel, onOMDefaults);
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              {
                provider: 'openai',
                source: connected ? 'stored-user' : 'none',
                envVar: 'OPENAI_API_KEY',
              },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: connected
              ? [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }]
              : [],
          }),
        ),
        http.put(`${TEST_BASE_URL}/web/config/providers/openai/key`, async ({ request }) => {
          expect(await request.json()).toEqual({ key: 'sk-test', envVar: 'OPENAI_API_KEY', scope: 'user' });
          connected = true;
          return HttpResponse.json({ ok: true });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={onComplete} />);

      // The unconnected provider only appears through search; picking its
      // badge opens the API key dialog directly.
      await user.type(await screen.findByRole('searchbox', { name: 'Search model providers' }), 'openai');
      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      const dialog = within(screen.getByRole('dialog'));
      await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-test');
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await user.click(await screen.findByRole('button', { name: 'Finish setup' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(onFactoryModel).toHaveBeenCalledWith({ defaultModelId: 'openai/gpt-5.6-sol' });
      expect(onOMDefaults).toHaveBeenCalledWith({
        providerId: 'openai',
        factoryModelId: 'openai/gpt-5.6-sol',
      });
    });
  });
});
