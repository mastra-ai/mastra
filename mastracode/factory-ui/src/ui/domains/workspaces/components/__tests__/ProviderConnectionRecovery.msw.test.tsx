import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { chooseProvider, chooseSubscription, openProviderList, renderModelSection } from './fixtures/modelSection';

const base = `${TEST_BASE_URL}/web/config/providers`;
const modelsUrl = `${TEST_BASE_URL}/web/config/models`;
const models = [{ id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true }];
const openai: ProviderInfo = {
  provider: 'openai',
  source: 'none',
  envVar: 'OPENAI_API_KEY',
  oauth: { supported: true, modes: ['device-code'] },
};
const session = {
  sessionId: 'device-session',
  kind: 'device-code',
  url: 'https://auth.openai.com/codex/device',
  userCode: 'ABCD-1234',
  instructions: 'Enter code: ABCD-1234',
  expiresAt: Date.now() + 600_000,
  nextPollMs: 10,
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(base, () => HttpResponse.json({ providers: [openai], orgKeyAdmin: true })),
    http.get(modelsUrl, () => HttpResponse.json({ models })),
    http.post(`${base}/openai/oauth/start`, () => HttpResponse.json(session)),
    // A connected personal lane starts on the caller's saved default model, when there is one.
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
  );
});

describe('provider connection recovery', () => {
  it.each(['org', 'user'] as const)(
    'uses the real device flow and refreshes the %s credential before offering models',
    async scope => {
      let saved = false;
      // The user approves on the provider's site only after the dialog was checked, so a fast poll can't close it first.
      let approved = false;
      const pollStatuses: string[] = [];
      const starts: unknown[] = [];
      server.use(
        http.get(base, () => {
          const provider: ProviderInfo = {
            ...openai,
            source: saved ? (scope === 'org' ? 'oauth-org' : 'oauth-user') : 'none',
            ...(saved ? { [scope === 'org' ? 'orgCredential' : 'userCredential']: 'oauth' } : {}),
          };
          return HttpResponse.json({ providers: [provider], orgKeyAdmin: true });
        }),
        http.post(`${base}/openai/oauth/start`, async ({ request }) => {
          starts.push(await request.json());
          return HttpResponse.json(session);
        }),
        http.post(`${base}/openai/oauth/poll`, async ({ request }) => {
          expect(await request.json()).toEqual({ sessionId: session.sessionId });
          if (!approved) {
            pollStatuses.push('pending');
            return HttpResponse.json({ status: 'pending', nextPollMs: 50 });
          }
          saved = true;
          pollStatuses.push('complete');
          return HttpResponse.json({ status: 'complete' });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderModelSection({ draft: { modelScope: scope === 'org' ? 'factory' : 'user' } });
      await chooseSubscription(user, 'Continue with OpenAI');
      const dialog = within(await screen.findByRole('dialog'));
      expect(dialog.getByText(session.userCode)).toBeVisible();
      expect(dialog.queryByRole('textbox', { name: 'Authorization code' })).not.toBeInTheDocument();
      expect(dialog.getByText(scope === 'org' ? /Everyone in your organization/ : /only for you/)).toBeVisible();
      expect(starts).toEqual([{ mode: 'device-code', scope }]);
      await waitFor(() => expect(pollStatuses).toContain('pending'));
      approved = true;
      expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
      await waitForMutationsIdle(client);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(pollStatuses.filter(status => status === 'complete')).toEqual(['complete']);
    },
  );

  it('reports expired device authorization, cancels it and permits a fresh attempt', async () => {
    const cancelled: string[] = [];
    server.use(
      http.post(`${base}/openai/oauth/poll`, () =>
        HttpResponse.json({ status: 'failed', error: 'Authorization expired. Start again.' }),
      ),
      http.delete(`${base}/openai/oauth/session/:session`, ({ params }) => {
        cancelled.push(String(params.session));
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderModelSection({ draft: { modelScope: 'factory' } });
    await chooseSubscription(user, 'Continue with OpenAI');
    expect(await screen.findByRole('alert')).toHaveTextContent('Authorization expired');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitForMutationsIdle(client);
    expect(cancelled).toEqual([session.sessionId]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await chooseSubscription(user, 'Continue with OpenAI');
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('keeps a failed API key save editable and prevents duplicate submissions while saving', async () => {
    let writes = 0;
    server.use(
      http.put(`${base}/openai/key`, async () => {
        writes++;
        if (writes === 1) return HttpResponse.json({ error: 'Credential storage unavailable' }, { status: 503 });
        await delay(150);
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderModelSection({ draft: { modelScope: 'factory' } });
    await chooseProvider(user, 'OpenAI');
    const input = within(screen.getByRole('dialog')).getByLabelText('API key for OpenAI');
    await user.type(input, 'test-key{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Credential storage unavailable');
    expect(input).toBeEnabled();
    await user.type(input, '{Enter}{Enter}');
    expect(input).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toBe(2);
  });

  it('recovers a failed provider catalog without leaving the step', async () => {
    let failed = true;
    server.use(
      http.get(base, () =>
        failed
          ? HttpResponse.json({ error: 'Providers unavailable' }, { status: 503 })
          : HttpResponse.json({ providers: [openai], orgKeyAdmin: true }),
      ),
    );
    const user = userEvent.setup();
    renderModelSection({ draft: { modelScope: 'factory' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Providers unavailable');
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await openProviderList(user);
    expect(screen.getByRole('button', { name: 'OpenAI' })).toBeEnabled();
  });

  it('allows retry or a different provider when a connected account has no models', async () => {
    let empty = true;
    server.use(
      http.get(base, () =>
        HttpResponse.json({
          providers: [{ ...openai, source: 'stored-org', orgCredential: 'api_key' }],
          orgKeyAdmin: true,
        }),
      ),
      http.get(modelsUrl, () => HttpResponse.json({ models: empty ? [] : models })),
    );
    const user = userEvent.setup();
    renderModelSection({ draft: { modelScope: 'factory' } });
    await chooseProvider(user, 'OpenAI');
    expect(await screen.findByRole('alert')).toHaveTextContent('No models are available');
    expect(screen.getByRole('button', { name: 'Provider: OpenAI' })).toBeEnabled();
    empty = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox')).toHaveValue('GPT-5.6 Sol');
  });

  it('does not present deployment-managed access as a personal API key', async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json({ providers: [{ provider: 'amazon-bedrock', source: 'deployment' }], orgKeyAdmin: false }),
      ),
    );
    renderModelSection({ draft: { modelScope: 'user' } });
    await openProviderList(userEvent.setup());
    expect(screen.getByText('No API key providers available.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Amazon Bedrock' })).not.toBeInTheDocument();
  });

  it('does not infer API-key support from an existing shared sign-in', async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json({
          providers: [
            {
              provider: 'github-copilot',
              source: 'oauth-org',
              orgKey: true,
              orgCredential: 'oauth',
              oauth: { supported: true, modes: ['device-code'] },
            },
          ],
          orgKeyAdmin: true,
        }),
      ),
    );
    const user = userEvent.setup();
    renderModelSection({ draft: { modelScope: 'factory' } });
    await openProviderList(user);
    expect(screen.getByRole('button', { name: 'Use GitHub Copilot connection' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'API key' }));
    expect(screen.getByText('No API key providers available.')).toBeVisible();
  });
});
