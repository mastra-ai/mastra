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
import {
  chooseProvider,
  chooseSubscription,
  modelSectionRepository,
  openProviderList,
  renderModelSection,
} from './fixtures/modelSection';

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

const openaiModels = [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }];

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

      renderModelSection();

      expect(await screen.findByRole('alert')).toHaveTextContent('Provider catalog unavailable');
      expect(screen.queryByText(/No providers match/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });
  });

  describe('when the provider catalog contains sign-in and API-key providers', () => {
    it('shows API-key providers first, switches to subscriptions, and searches across both', async () => {
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

      renderModelSection();

      await openProviderList(user);
      expect(screen.getByRole('radio', { name: 'API key' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'bedrock');

      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Groq' })).not.toBeInTheDocument();

      await user.clear(screen.getByRole('searchbox', { name: 'Search model providers' }));
      await user.click(screen.getByRole('radio', { name: 'Subscription' }));
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Amazon Bedrock' })).not.toBeInTheDocument();

      // A match only under API key brings that tab forward instead of showing an empty list.
      await user.type(screen.getByRole('searchbox', { name: 'Search model providers' }), 'bedrock');
      expect(screen.getByRole('radio', { name: 'API key' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Amazon Bedrock' })).toBeInTheDocument();

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
              { provider: 'groq', source: 'none' },
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
      const user = userEvent.setup();

      const { onCreate } = renderModelSection();

      const useGateway = await screen.findByRole('button', { name: 'Connect Mastra Gateway' });
      expect(await screen.findByText('Pay with your organization’s Mastra credits ($12.40 left)')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Mastra Gateway' })).not.toBeInTheDocument();
      await user.click(useGateway);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(connectBodies).toEqual([{ scope: 'org' }]);
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'mastra', method: 'api_key', modelId: 'mastra/anthropic/claude-opus-5.5' },
      });
      expect(screen.queryByText('No gateway credits left')).not.toBeInTheDocument();
    });

    it('shows the gateway connection and its model in the lane', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 12.4 });
      const user = userEvent.setup();

      const { onCreate } = renderModelSection();

      expect(await screen.findByRole('radio', { name: 'Mastra Gateway' })).toBeChecked();
      expect(screen.getByText('Recommended')).toBeVisible();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByText('Connected')).toBeVisible();
      expect(screen.getByText('Pay with your organization’s Mastra credits ($12.40 left)')).toBeVisible();
      expect(await screen.findByRole('combobox')).toHaveValue('Claude Opus 5.5');
      expect(screen.getByRole('radio', { name: 'Mastra Gateway' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'mastra', method: 'api_key', modelId: 'mastra/anthropic/claude-opus-5.5' },
      });
    });

    it('drops a connected gateway when the account switches to its own provider', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 12.4 });
      const user = userEvent.setup();

      renderModelSection();
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));
      expect(await screen.findByRole('combobox')).toHaveValue('Claude Opus 5.5');

      await user.click(screen.getByRole('radio', { name: 'Your own provider' }));

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose a provider' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });

    it('keeps the organization-billed gateway to Factory work when sessions use personal accounts', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 12.4 });
      const user = userEvent.setup();

      renderModelSection({ draft: { modelScope: 'hybrid' } });
      const work = within(await screen.findByRole('group', { name: 'Factory work' }));
      expect(await work.findByRole('radio', { name: 'Mastra Gateway' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: 'Connect Mastra Gateway' }));
      expect(await work.findByRole('combobox')).toHaveValue('Claude Opus 5.5');

      const sessions = within(screen.getByRole('group', { name: 'Your sessions' }));
      expect(sessions.queryByRole('radio', { name: 'Mastra Gateway' })).not.toBeInTheDocument();
      expect(sessions.getByRole('button', { name: 'Choose a provider' })).toBeVisible();
      expect(screen.queryByRole('button', { name: /Mastra Gateway/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });

    it('sends the organization to add credits on Mastra in a new tab when it has none left', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 0 });
      const user = userEvent.setup();

      renderModelSection();
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByText('No gateway credits left')).toBeVisible();
      const addCredits = screen.getByRole('link', { name: 'Add credits' });
      expect(addCredits).toHaveAttribute('href', 'https://projects.mastra.ai/add-credits/org-1');
      expect(addCredits).toHaveAttribute('target', '_blank');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled());
    });

    it('asks a member who is not a Mastra admin to get an admin to add credits', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 0, canAddCredits: false });
      const user = userEvent.setup();

      renderModelSection();
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByText('Ask an admin of your Mastra organization to add credits.')).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Add credits' })).not.toBeInTheDocument();
    });

    it('does not warn about credits while the platform reports no balance', async () => {
      registerAuthHandler();
      registerGatewayHandlers({});
      const user = userEvent.setup();

      renderModelSection();
      await user.click(await screen.findByRole('button', { name: 'Connect Mastra Gateway' }));

      expect(await screen.findByRole('combobox')).toHaveValue('Claude Opus 5.5');
      expect(screen.queryByText('No gateway credits left')).not.toBeInTheDocument();
    });

    it('connects the gateway from its account while Create factory waits for a ready model', async () => {
      registerAuthHandler();
      registerGatewayHandlers({ remainingCredits: 12.4 });
      const user = userEvent.setup();

      renderModelSection({ draft: { modelScope: 'user' } });

      const account = within(await screen.findByRole('group', { name: 'Your account' }));
      expect(await account.findByRole('radio', { name: 'Mastra Gateway' })).toBeChecked();
      expect(account.getByRole('button', { name: 'Connect Mastra Gateway' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();

      await user.click(account.getByRole('radio', { name: 'Your own provider' }));
      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
      await chooseProvider(user, 'Groq', account);
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
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

      const user = userEvent.setup();

      renderModelSection();

      await openProviderList(user);
      expect(screen.getByRole('button', { name: 'Mastra Gateway' })).toBeInTheDocument();
      // Checked with the list open too, so the one-click card can't hide anywhere on the page.
      expect(screen.queryByRole('button', { name: 'Connect Mastra Gateway' })).not.toBeInTheDocument();
    });
  });

  describe('when creating a custom provider', () => {
    function registerCustomProviderHandlers({ orgKeyAdmin = true }: { orgKeyAdmin?: boolean } = {}) {
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
            orgKeyAdmin,
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

    function registerNoPersonalDefault() {
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
          HttpResponse.json({ modelId: null, thinkingLevel: null }),
        ),
      );
    }

    async function createCustomProvider(lane?: Parameters<typeof openProviderList>[1]) {
      const user = userEvent.setup();
      await openProviderList(user, lane);
      await user.click(screen.getByRole('button', { name: 'Add a custom provider' }));
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
      renderModelSection();
      const user = userEvent.setup();

      await openProviderList(user);
      await user.click(screen.getByRole('button', { name: 'Add a custom provider' }));
      await user.type(screen.getByPlaceholderText('e.g. my-llm'), 'my-llm');
      await user.type(screen.getByPlaceholderText('https://api.example.com/v1'), 'https://api.example.com/v1');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByText('At least one model is required.')).toBeVisible();
    });

    it('refreshes the catalogs and continues to organization model selection', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers();
      const { client, onCreate } = renderModelSection();

      const user = await createCustomProvider();
      await waitForMutationsIdle(client);

      expect(await screen.findByRole('combobox')).toHaveValue('Model A');
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'my-llm', modelId: 'my-llm/model-a', method: 'api_key' },
      });
    });

    it('continues to personal model selection with the stored custom provider', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers();
      registerNoPersonalDefault();
      const { client, onCreate } = renderModelSection({ draft: { modelScope: 'user' } });

      const user = await createCustomProvider();
      await waitForMutationsIdle(client);

      expect(await screen.findByRole('combobox')).toHaveValue('Model A');
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'user',
        personal: { providerId: 'my-llm', method: 'api_key', modelId: 'my-llm/model-a' },
      });
    });

    it('keeps a member on personal accounts after their custom provider unlocks the company account', async () => {
      registerAuthHandler();
      registerCustomProviderHandlers({ orgKeyAdmin: false });
      registerNoPersonalDefault();
      // No stored scope: the member lands on personal accounts only because the company account is locked.
      const { client, onCreate } = renderModelSection();
      const yourAccount = within(await screen.findByRole('group', { name: 'Your account' }));

      const user = await createCustomProvider(yourAccount);
      await waitForMutationsIdle(client);

      expect(screen.getByRole('radio', { name: 'Personal accounts' })).toBeChecked();
      expect(await within(screen.getByRole('group', { name: 'Your account' })).findByRole('combobox')).toHaveValue(
        'Model A',
      );
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'user',
        personal: { providerId: 'my-llm', method: 'api_key', modelId: 'my-llm/model-a' },
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

      renderModelSection();

      await chooseSubscription(user, 'Continue with Anthropic');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(onStart).toHaveBeenCalledWith({ mode: 'paste-code', scope: 'org' });
    });
  });

  describe('when OpenAI is already connected', () => {
    it('keeps the suggested Factory model in the draft without saving defaults', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onOMDefaults = vi.fn<(body: unknown) => void>();
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
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );
      const user = userEvent.setup();

      const { onCreate } = renderModelSection();

      await chooseProvider(user, 'OpenAI');

      // Once the provider is set, the list closes and the lane shows the provider and its model.
      expect(screen.getByRole('button', { name: 'Provider: OpenAI' })).toBeInTheDocument();
      expect(screen.queryByRole('searchbox', { name: 'Search model providers' })).not.toBeInTheDocument();
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      await user.click(screen.getByRole('button', { name: 'Create factory' }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
      expect(onFactoryModel).not.toHaveBeenCalled();
      expect(onOMDefaults).not.toHaveBeenCalled();
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'openai', modelId: 'openai/gpt-5.6-sol', method: 'api_key' },
      });
    });

    it('keeps OpenAI and its model when connecting another provider is cancelled', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
              { provider: 'groq', source: 'none' },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );
      const user = userEvent.setup();

      const { onCreate } = renderModelSection();
      await chooseProvider(user, 'OpenAI');
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');

      await chooseProvider(user, 'Groq');
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('button', { name: 'Provider: OpenAI' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: { providerId: 'openai', modelId: 'openai/gpt-5.6-sol', method: 'api_key' } }),
      );
    });

    it('keeps OpenAI and its model when a subscription sign-in is cancelled', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
              { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
        http.post(`${TEST_BASE_URL}/web/config/providers/anthropic/oauth/start`, () =>
          HttpResponse.json({
            sessionId: 'session-1',
            kind: 'paste-code',
            url: 'https://claude.ai/oauth/authorize',
            instructions: 'Open the link, authorize, then paste the code shown on the final page.',
            expiresAt: Date.now() + 600_000,
          }),
        ),
        http.delete(`${TEST_BASE_URL}/web/config/providers/anthropic/oauth/session/:session`, () =>
          HttpResponse.json({ ok: true }),
        ),
      );
      const user = userEvent.setup();

      const { onCreate } = renderModelSection();
      await chooseProvider(user, 'OpenAI');
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');

      await chooseSubscription(user, 'Continue with Anthropic');
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('button', { name: 'Provider: OpenAI' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: { providerId: 'openai', modelId: 'openai/gpt-5.6-sol', method: 'api_key' } }),
      );
    });
  });

  describe('when Create factory is disabled', () => {
    const groqOnly: ProviderInfo[] = [{ provider: 'groq', source: 'none' }];
    const openaiOrg: ProviderInfo[] = [
      { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
    ];
    const savedOpenai = { providerId: 'openai', method: 'api_key' as const, modelId: 'openai/gpt-5.6-sol' };

    it.each([
      {
        name: 'the company account has no provider',
        providers: groqOnly,
        draft: { modelScope: 'factory' as const },
        reason: 'Connect the company account to create your factory.',
      },
      {
        name: 'the personal account has no provider',
        providers: groqOnly,
        draft: { modelScope: 'user' as const },
        reason: 'Connect your account to create your factory.',
      },
      {
        name: 'neither hybrid account has a provider',
        providers: groqOnly,
        draft: { modelScope: 'hybrid' as const },
        reason: 'Connect an account for Factory work and connect your account for sessions to create your factory.',
      },
      {
        name: 'only the sessions account is missing in hybrid',
        providers: openaiOrg,
        draft: { modelScope: 'hybrid' as const, model: savedOpenai },
        reason: 'Connect your account for sessions to create your factory.',
      },
      {
        name: 'the company model was retired',
        providers: openaiOrg,
        draft: { modelScope: 'factory' as const, model: { ...savedOpenai, modelId: 'openai/retired-model' } },
        reason: 'Pick a model for the company account to create your factory.',
      },
    ])('names the missing step when $name', async ({ providers, draft, reason }) => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers })),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );

      renderModelSection({ draft });

      const create = await screen.findByRole('button', { name: 'Create factory' });
      await waitFor(() => expect(create).toHaveAccessibleDescription(reason));
      expect(create).toBeDisabled();
    });

    it('names the missing provider in local mode', async () => {
      server.use(http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: groqOnly })));

      renderModelSection({ local: true });

      const create = await screen.findByRole('button', { name: 'Create factory' });
      await waitFor(() => expect(create).toHaveAccessibleDescription('Connect a provider to create your factory.'));
      expect(create).toBeDisabled();
    });
  });

  describe('when OpenAI has only a personal API key', () => {
    it('still requires an organization credential and fixes the dialog to org scope', async () => {
      const onFactoryModel = vi.fn<(body: unknown) => void>();
      const onOMDefaults = vi.fn<(body: unknown) => void>();
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
          HttpResponse.json({ models: connected ? openaiModels : [] }),
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

      const { onCreate } = renderModelSection();

      // Picking an unconnected provider opens the API key dialog directly.
      await chooseProvider(user, 'OpenAI');
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.queryByRole('button', { name: 'Just me' })).not.toBeInTheDocument();
      expect(dialog.queryByRole('button', { name: 'Everyone in org' })).not.toBeInTheDocument();
      await user.type(dialog.getByLabelText('API key for OpenAI'), 'sk-test');
      await user.click(dialog.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      await user.click(screen.getByRole('button', { name: 'Create factory' }));

      await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
      expect(onFactoryModel).not.toHaveBeenCalled();
      expect(onOMDefaults).not.toHaveBeenCalled();
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'openai', modelId: 'openai/gpt-5.6-sol', method: 'api_key' },
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

      renderModelSection();

      expect(await screen.findByRole('button', { name: 'Choose a provider' })).toBeVisible();
      await chooseProvider(user, 'Amazon Bedrock');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('combobox')).toHaveValue('Claude Sonnet 4.5');
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled();
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
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );
      const user = userEvent.setup();

      renderModelSection();

      await openProviderList(user);
      expect(screen.getByRole('button', { name: 'OpenAI' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Groq' })).toBeDisabled();
      await user.click(screen.getByRole('radio', { name: 'Subscription' }));
      expect(screen.getByRole('button', { name: 'Continue with Anthropic' })).toBeDisabled();
      await user.click(screen.getByRole('radio', { name: 'API key' }));

      await user.click(screen.getByRole('button', { name: 'OpenAI' }));
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeEnabled();
    });

    it('opens a member on the shared providers when only an admin could connect the gateway', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [
              { provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true },
              { provider: 'mastra', source: 'none', orgKey: false, connectWithMastraAccount: true },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );
      const user = userEvent.setup();

      renderModelSection();

      const account = within(await screen.findByRole('group', { name: 'Company account' }));
      expect(await account.findByRole('radio', { name: 'Your own provider' })).toBeChecked();
      await user.click(account.getByRole('radio', { name: 'Mastra Gateway' }));
      expect(account.getByRole('button', { name: 'Connect Mastra Gateway' })).toHaveAccessibleDescription(
        /Only an organization admin/,
      );
    });

    it('switches members without a company account to personal accounts', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            orgKeyAdmin: false,
            providers: [{ provider: 'openai', source: 'stored-user', userCredential: 'api_key' }],
          }),
        ),
      );

      renderModelSection({ draft: { modelScope: 'factory' } });

      // Base UI renders radios as spans, so the disabled state is carried by aria-disabled.
      expect(await screen.findByRole('radio', { name: 'Company account' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio', { name: 'Company work and personal sessions' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('radio', { name: 'Personal accounts' })).toBeChecked();
      expect(
        within(screen.getByRole('group', { name: 'Your account' })).getByRole('button', { name: 'Choose a provider' }),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });
  });

  describe('when a saved choice no longer resolves', () => {
    it('keeps Create disabled and explains a retired saved model', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [{ provider: 'openai', source: 'stored-org', orgCredential: 'api_key', orgKey: true }],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );

      renderModelSection({
        draft: {
          modelScope: 'factory',
          model: { providerId: 'openai', method: 'api_key', modelId: 'openai/retired-model' },
        },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your previous model is no longer available. Choose another model.',
      );
      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });

    it('explains a saved provider whose connection is gone', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ providers: [{ provider: 'groq', source: 'none', envVar: 'GROQ_API_KEY' }] }),
        ),
      );

      // A choice is saved only once its provider connected, so a saved Groq that no longer connects (its key
      // was removed since) must be explained rather than reopen as a blank picker.
      renderModelSection({
        draft: { modelScope: 'factory', model: { providerId: 'groq', method: 'api_key', modelId: '' } },
      });

      expect(
        await screen.findByText(
          'Your Groq connection changed since you chose it. Connect it again or choose another provider.',
        ),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });

    it('explains a saved provider that left the provider list', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ providers: [{ provider: 'groq', source: 'none' }] }),
        ),
      );

      // A deleted custom provider can't be connected again, so the notice must not offer that.
      renderModelSection({
        draft: { modelScope: 'factory', model: { providerId: 'my-llm', method: 'api_key', modelId: 'my-llm/model-a' } },
      });

      expect(await screen.findByText(/is no longer available\. Choose another provider\./)).toBeVisible();
      expect(screen.queryByText(/Connect it again/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
    });

    it('explains a saved connection whose method changed', async () => {
      registerAuthHandler();
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({
            providers: [
              {
                provider: 'openai',
                source: 'oauth-org',
                orgCredential: 'oauth',
                orgKey: true,
                oauth: { supported: true, modes: ['device-code'] },
              },
            ],
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );

      renderModelSection({
        draft: {
          modelScope: 'factory',
          model: { providerId: 'openai', method: 'api_key', modelId: 'openai/gpt-5.6-sol' },
        },
      });

      expect(
        await screen.findByText(
          'Your OpenAI connection changed since you chose it. Connect it again or choose another provider.',
        ),
      ).toBeVisible();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create factory' })).toBeDisabled();
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
        http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models: openaiModels })),
      );
      const user = userEvent.setup();

      const { onCreate } = renderModelSection({ local: true });

      await chooseProvider(user, 'OpenAI');
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      await user.click(screen.getByRole('button', { name: 'Create factory' }));
      expect(onCreate).toHaveBeenCalledWith({
        repository: modelSectionRepository,
        modelScope: 'factory',
        model: { providerId: 'openai', method: 'api_key', modelId: 'openai/gpt-5.6-sol' },
      });
    });
  });
});
