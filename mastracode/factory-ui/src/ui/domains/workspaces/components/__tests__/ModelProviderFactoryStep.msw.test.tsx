import { Command } from '@mastra/playground-ui/components/Command';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { CreateFactoryModelStep } from '../create-factory/CreateFactoryModelStep';
import { ModelProviderFactoryStep } from '../ModelProviderFactoryStep';

function registerAuthHandler() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
  );
}

function registerPersistenceHandlers(onFactoryModel: (body: unknown) => void) {
  server.use(
    http.patch(`${TEST_BASE_URL}/web/factory/projects/factory-1`, async ({ request }) => {
      onFactoryModel(await request.json());
      return HttpResponse.json({ project: { id: 'factory-1', name: 'Factory', defaultModelId: 'openai/gpt-5.6-sol' } });
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
    it('shows API-key providers by default and filters them through search', async () => {
      const providers: ProviderInfo[] = [
        { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: [] } },
        { provider: 'amazon-bedrock', source: 'none' },
        { provider: 'groq', source: 'none' },
      ];
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      expect(await screen.findByRole('button', { name: 'Continue with Anthropic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'bedrock');

      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Groq' })).not.toBeInTheDocument();
      // The sign-in section is a fixed top-level section — search never hides it.
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeInTheDocument();

      await user.clear(screen.getByRole('searchbox', { name: 'Search model providers' }));
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'no-such-provider');

      expect(screen.getByText(/No providers match/)).toHaveTextContent('No providers match “no-such-provider”.');
      expect(screen.queryByRole('button', { name: 'Amazon Bedrock' })).not.toBeInTheDocument();
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
      expect(onStart).toHaveBeenCalledWith({ mode: 'paste-code', scope: 'org' });
    });
  });

  describe('when OpenAI is already connected', () => {
    it('persists the suggested Factory model without materializing automatic OM models', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onComplete = vi.fn<() => void>();
      const providers: ProviderInfo[] = [
        {
          provider: 'openai',
          source: 'stored-user',
          userCredential: 'api_key',
          orgCredential: 'api_key',
          orgKey: true,
        },
        { provider: 'anthropic', source: 'none' },
      ];
      registerAuthHandler();
      registerPersistenceHandlers(onFactoryModel);
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
    });
  });

  describe('when OpenAI has only a personal API key', () => {
    it('still requires an organization credential and fixes the dialog to org scope', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onComplete = vi.fn<() => void>();
      let connected = false;
      registerAuthHandler();
      registerPersistenceHandlers(onFactoryModel);
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              {
                provider: 'openai',
                source: connected ? 'stored-org' : 'stored-user',
                userCredential: 'api_key',
                orgCredential: connected ? 'api_key' : undefined,
                orgKey: connected,
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
          // Factory setup defaults to an org-wide key so the whole team can
          // use the factory default model, not just the person setting it up.
          expect(await request.json()).toEqual({ key: 'sk-test', envVar: 'OPENAI_API_KEY', scope: 'org' });
          connected = true;
          return HttpResponse.json({ ok: true });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={onComplete} />);

      // Unconnected providers are browseable without searching; picking the
      // badge opens the API key dialog directly.
      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.queryByRole('button', { name: 'Just me' })).not.toBeInTheDocument();
      expect(dialog.queryByRole('button', { name: 'Everyone in org' })).not.toBeInTheDocument();
      await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-test');
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await user.click(await screen.findByRole('button', { name: 'Finish setup' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(onFactoryModel).toHaveBeenCalledWith({ defaultModelId: 'openai/gpt-5.6-sol' });
    });
  });

  describe('when the user is not an organization admin', () => {
    it('keeps shared providers selectable and disables new organization connections', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [
              { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
              { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
              { provider: 'groq', source: 'none' },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      expect(await screen.findByRole('button', { name: 'OpenAI' })).toBeEnabled();
      expect(screen.queryByText(/Ask an organization admin/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'OpenAI' }));
      expect(await screen.findByRole('button', { name: 'Finish setup' })).toBeInTheDocument();
    });

    it('guides members to an admin when no organization provider is connected', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
          }),
        ),
      );

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      expect(await screen.findByText(/Ask an organization admin/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OpenAI' })).toBeDisabled();
    });
  });

  describe('when creating a later Factory', () => {
    it('keeps personal credentials connected under the existing default semantics', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(
        <Command>
          <CreateFactoryModelStep query="" onPick={vi.fn()} />
        </Command>,
      );

      await user.click(await screen.findByText('OpenAI'));

      expect(await screen.findByText('openai/gpt-5.6-sol')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Connect OpenAI' })).not.toBeInTheDocument();
    });
  });

  describe('when authentication is disabled', () => {
    it('keeps local credentials on the existing unscoped behavior', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ providers: [{ provider: 'openai', source: 'stored' }] }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }],
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep factoryId="factory-1" onComplete={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      expect(await screen.findByRole('button', { name: 'Finish setup' })).toBeInTheDocument();
    });
  });
});
