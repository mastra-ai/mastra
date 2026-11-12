import { Command } from '@mastra/playground-ui/components/Command';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { datedModels } from '../../../settings/components/__tests__/fixtures/models';
import { CreateFactoryModelStep } from '../create-factory/CreateFactoryModelStep';
import { ModelProviderFactoryStep } from '../ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from '../PersonalProviderFactoryStep';

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
      return HttpResponse.json({ error: 'Removed endpoint' }, { status: 404 });
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

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

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      expect(await screen.findByRole('tab', { name: 'Provider sign-in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'bedrock');

      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Groq' })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Provider sign-in' })).toBeInTheDocument();

      await user.clear(screen.getByRole('searchbox', { name: 'Search model providers' }));
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'no-such-provider');

      expect(screen.getByText(/No providers match/)).toHaveTextContent('No providers match “no-such-provider”.');
      expect(screen.queryByRole('button', { name: 'Amazon Bedrock' })).not.toBeInTheDocument();
    });
  });

  describe('when Factory is signed in with a Mastra account', () => {
    function registerGatewayHandlers({
      remainingCredits,
      canAddCredits = true,
    }: {
      remainingCredits?: number;
      canAddCredits?: boolean;
    }) {
      let connected = false;
      const connectBodies: unknown[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: [] } },
              connected
                ? {
                    provider: 'mastra',
                    source: 'stored-org',
                    orgKey: true,
                    orgCredential: 'api_key',
                    connectWithMastraAccount: true,
                  }
                : { provider: 'mastra', source: 'none', orgKey: false, connectWithMastraAccount: true },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: connected
              ? ['anthropic/claude-sonnet-4.6', 'anthropic/claude-opus-5.5'].map(modelName => ({
                  id: `mastra/${modelName}`,
                  provider: 'mastra',
                  modelName,
                  hasApiKey: true,
                }))
              : [],
          }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/providers/mastra/connect`, async ({ request }) => {
          connectBodies.push(await request.json());
          connected = true;
          return HttpResponse.json({ ok: true });
        }),
        http.get(`${TEST_BASE_URL}/web/config/providers/mastra/credits`, () =>
          HttpResponse.json({
            remaining: remainingCredits,
            unlimited: false,
            canAddCredits,
            addCreditsUrl: 'https://projects.mastra.ai/add-credits/org-1',
          }),
        ),
      );
      return { connectBodies };
    }

    it('connects the Mastra Gateway in one click and starts on its default model', async () => {
      registerAuthHandler();
      const { connectBodies } = registerGatewayHandlers({ remainingCredits: 12.4 });
      const onComplete = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={onComplete} onChangeSetup={vi.fn()} />);

      const useGateway = await screen.findByRole('button', { name: 'Connect Mastra Gateway' });
      expect(await screen.findByText('Pay with your organization’s Mastra credits ($12.40 left)')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Mastra Gateway' })).not.toBeInTheDocument();
      await user.click(useGateway);

      await user.click(await screen.findByRole('button', { name: 'Continue' }));
      expect(connectBodies).toEqual([{ scope: 'org' }]);
      expect(onComplete).toHaveBeenCalledWith({
        providerId: 'mastra',
        method: 'api_key',
        modelId: 'mastra/anthropic/claude-opus-5.5',
      });
      expect(screen.queryByText('No gateway credits left')).not.toBeInTheDocument();
    });

    it('sends the organization to add credits on Mastra in a new tab when it has none left', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 0 });
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByText('No gateway credits left')).toBeVisible();
      const addCredits = screen.getByRole('link', { name: 'Add credits' });
      expect(addCredits).toHaveAttribute('href', 'https://projects.mastra.ai/add-credits/org-1');
      expect(addCredits).toHaveAttribute('target', '_blank');
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });

    it('asks a member who is not a Mastra admin to get an admin to add credits', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 0, canAddCredits: false });
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByText('Ask an admin of your Mastra organization to add credits.')).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Add credits' })).not.toBeInTheDocument();
    });

    it('does not warn about credits while the platform reports no balance', async () => {
      registerAuthHandler();
      registerGatewayHandlers({});
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.queryByText('No gateway credits left')).not.toBeInTheDocument();
    });
  });

  describe('when Factory auth cannot create Mastra Gateway keys', () => {
    it('offers the Mastra Gateway as an API-key provider instead of the one-click card', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: [] } },
              { provider: 'mastra', source: 'none', orgKey: false },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: [] })),
      );

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      expect(await screen.findByRole('button', { name: 'Mastra Gateway' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
    });
  });

  describe('when creating a custom provider', () => {
    function registerCustomProviderHandlers() {
      let created = false;
      const provider = {
        id: 'my-llm',
        name: 'my-llm',
        url: 'https://api.example.com/v1',
        hasApiKey: true,
        models: ['model-a'],
      };
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: created ? [{ provider: 'my-llm', source: 'stored-org', custom: true }] : [],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: created
              ? [{ id: 'my-llm/model-a', provider: 'my-llm', modelName: 'model-a', hasApiKey: true }]
              : [],
          }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/custom-providers`, async ({ request }) => {
          expect(await request.json()).toEqual({
            name: 'my-llm',
            url: 'https://api.example.com/v1',
            apiKey: 'sk-test',
            models: ['model-a'],
          });
          created = true;
          return HttpResponse.json({ ok: true, provider });
        }),
      );
    }

    async function createCustomProvider() {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('tab', { name: 'Custom provider' }));
      await user.type(screen.getByPlaceholderText('e.g. my-llm'), 'my-llm');
      await user.type(screen.getByPlaceholderText('https://api.example.com/v1'), 'https://api.example.com/v1');
      await user.type(screen.getByPlaceholderText('Paste API key'), 'sk-test');
      await user.type(screen.getByPlaceholderText('model-a, model-b'), 'model-a');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      return user;
    }

    it('requires a model before creating a provider during setup', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers();
      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(await screen.findByRole('tab', { name: 'Custom provider' }));
      await user.type(screen.getByPlaceholderText('e.g. my-llm'), 'my-llm');
      await user.type(screen.getByPlaceholderText('https://api.example.com/v1'), 'https://api.example.com/v1');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByText('At least one model is required.')).toBeVisible();
    });

    it('refreshes the catalogs and continues to organization model selection', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers();
      const onComplete = vi.fn<() => void>();
      const { client } = renderWithProviders(
        <ModelProviderFactoryStep onComplete={onComplete} onChangeSetup={vi.fn()} />,
      );

      const user = await createCustomProvider();
      await waitForMutationsIdle(client);

      expect(await screen.findByRole('combobox')).toHaveValue('Model A');
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(onComplete).toHaveBeenCalledWith({
        providerId: 'my-llm',
        modelId: 'my-llm/model-a',
        method: 'api_key',
      });
    });

    it('continues to personal model selection with the stored custom provider', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
          HttpResponse.json({ modelId: null, thinkingLevel: null }),
        ),
      );
      const onContinue = vi.fn<() => void>();
      const { client } = renderWithProviders(<PersonalProviderFactoryStep onContinue={onContinue} />);

      const user = await createCustomProvider();
      await waitForMutationsIdle(client);

      expect(await screen.findByRole('combobox')).toHaveValue('Model A');
      await user.click(screen.getByRole('button', { name: 'Review setup' }));
      expect(onContinue).toHaveBeenCalledWith({
        providerId: 'my-llm',
        modelId: 'my-llm/model-a',
        method: 'api_key',
      });
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
      await user.click(screen.getByRole('button', { name: 'Continue with Anthropic' }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(onStart).toHaveBeenCalledWith({ mode: 'paste-code', scope: 'org' });
    });
  });

  describe('when OpenAI is already connected', () => {
    it('keeps the suggested Factory model in the draft without saving defaults', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onOMDefaults = vi.fn<(body: unknown) => void>();
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={onComplete} onChangeSetup={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));

      // Once the provider is set, the picker gives way to a focused model
      // selection view: provider name, model field, and a Change escape hatch.
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change provider' })).toBeInTheDocument();
      expect(screen.queryByRole('searchbox', { name: 'Search model providers' })).not.toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(onFactoryModel).not.toHaveBeenCalled();
      expect(onOMDefaults).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith({
        providerId: 'openai',
        modelId: 'openai/gpt-5.6-sol',
        method: 'api_key',
      });
    });
  });

  describe('when OpenAI has only a personal API key', () => {
    it('still requires an organization credential and fixes the dialog to org scope', async () => {
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={onComplete} onChangeSetup={vi.fn()} />);

      // Unconnected providers are browseable without searching; picking the
      // badge opens the API key dialog directly.
      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.queryByRole('button', { name: 'Just me' })).not.toBeInTheDocument();
      expect(dialog.queryByRole('button', { name: 'Everyone in org' })).not.toBeInTheDocument();
      await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-test');
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      await user.click(await screen.findByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
      expect(onFactoryModel).not.toHaveBeenCalled();
      expect(onOMDefaults).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith({
        providerId: 'openai',
        modelId: 'openai/gpt-5.6-sol',
        method: 'api_key',
      });
    });
  });

  describe('when the deployment provides Amazon Bedrock', () => {
    it('lets a member pick it as connected without an API-key dialog', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'amazon-bedrock', source: 'deployment' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [
              {
                id: 'amazon-bedrock/anthropic.claude-sonnet-4-5',
                provider: 'amazon-bedrock',
                modelName: 'anthropic.claude-sonnet-4-5',
                hasApiKey: true,
              },
            ],
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      const bedrock = await screen.findByRole('button', { name: 'Amazon Bedrock' });
      expect(bedrock).toBeEnabled();
      expect(screen.queryByText(/Ask an organization admin/)).not.toBeInTheDocument();
      await user.click(bedrock);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('Claude Sonnet 4.5');
    });
  });

  describe('when the server already has a Mastra Gateway key', () => {
    function registerServerGateway() {
      registerAuthHandler();
      const connect = vi.fn();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: true,
            providers: [{ provider: 'mastra', envVar: 'MASTRA_GATEWAY_API_KEY', source: 'deployment' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () =>
          HttpResponse.json({
            models: [
              {
                id: 'mastra/anthropic/claude-opus-5.5',
                provider: 'mastra',
                modelName: 'anthropic/claude-opus-5.5',
                hasApiKey: true,
              },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
          HttpResponse.json({ modelId: null, thinkingLevel: null }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/providers/mastra/connect`, () => {
          connect();
          return HttpResponse.json({ ok: true });
        }),
      );
      return connect;
    }

    it('shows the gateway as a connected provider for the company account, with no connect button', async () => {
      const connect = registerServerGateway();
      const user = userEvent.setup();

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      const gateway = await screen.findByRole('button', { name: 'Mastra Gateway' });
      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
      await user.click(gateway);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(connect).not.toHaveBeenCalled();
    });

    it('lets a person pick the gateway for their own sessions without connecting anything', async () => {
      const connect = registerServerGateway();
      const onContinue = vi.fn<() => void>();
      const user = userEvent.setup();

      renderWithProviders(<PersonalProviderFactoryStep onContinue={onContinue} />);

      const gateway = await screen.findByRole('button', { name: 'Mastra Gateway' });
      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
      await user.click(gateway);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: 'Review setup' }));
      expect(onContinue).toHaveBeenCalledWith({
        providerId: 'mastra',
        modelId: 'mastra/anthropic/claude-opus-5.5',
        method: 'api_key',
      });
      expect(connect).not.toHaveBeenCalled();
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      expect(await screen.findByRole('button', { name: 'OpenAI' })).toBeEnabled();
      expect(screen.queryByText(/Ask an organization admin/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeDisabled();
      await user.click(screen.getByRole('tab', { name: 'Provider sign-in' }));
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeDisabled();
      await user.click(screen.getByRole('tab', { name: 'API key' }));

      await user.click(screen.getByRole('button', { name: 'OpenAI' }));
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('sends members back to setup when no organization provider is connected', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
          }),
        ),
      );

      const onComplete = vi.fn();
      const onChangeSetup = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ModelProviderFactoryStep onComplete={onComplete} onChangeSetup={onChangeSetup} />);
      await user.click(await screen.findByRole('button', { name: 'Change setup' }));
      expect(onChangeSetup).toHaveBeenCalledOnce();
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
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

    it('offers newer models first', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: datedModels })),
      );
      const user = userEvent.setup();

      renderWithProviders(
        <Command>
          <CreateFactoryModelStep query="" onPick={vi.fn()} />
        </Command>,
      );

      await user.click(await screen.findByText('OpenAI'));
      await screen.findByText('openai/gpt-5');

      expect(screen.getAllByRole('option').map(option => option.getAttribute('data-value'))).toEqual([
        'openai/gpt-5',
        'openai/gpt-4.1',
        'openai/gpt-4o',
        'change-provider',
      ]);
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

      renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} onChangeSetup={vi.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });
});
