import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { ModelProviderFactoryStep } from '../ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from '../PersonalProviderFactoryStep';

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
  instructions: 'Enable device code authorization in your ChatGPT settings, then enter this code.',
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
  );
});

describe('provider connection recovery', () => {
  it.each(['org', 'user'] as const)(
    'uses the real device flow and refreshes the %s credential before offering models',
    async scope => {
      let saved = false;
      let polls = 0;
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
          polls++;
          if (polls === 1) return HttpResponse.json({ status: 'pending', nextPollMs: 150 });
          saved = true;
          return HttpResponse.json({ status: 'complete' });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderWithProviders(
        scope === 'org' ? (
          <ModelProviderFactoryStep onComplete={vi.fn()} />
        ) : (
          <PersonalProviderFactoryStep modelChoice="required" onContinue={vi.fn()} />
        ),
      );
      await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
      await user.click(screen.getByRole('button', { name: 'Continue with OpenAI' }));
      const dialog = within(await screen.findByRole('dialog'));
      expect(dialog.getByText(session.instructions)).toBeVisible();
      expect(dialog.getByText(session.userCode)).toBeVisible();
      expect(dialog.queryByRole('textbox', { name: 'Authorization code' })).not.toBeInTheDocument();
      expect(dialog.getByText(scope === 'org' ? /Everyone in your organization/ : /only for you/)).toBeVisible();
      expect(starts).toEqual([{ mode: 'device-code', scope }]);
      expect(await screen.findByRole('combobox')).toHaveTextContent(models[0].id);
      await waitForMutationsIdle(client);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(polls).toBe(2);
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
    const { client } = renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
    await user.click(screen.getByRole('button', { name: 'Continue with OpenAI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Authorization expired');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitForMutationsIdle(client);
    expect(cancelled).toEqual([session.sessionId]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue with OpenAI' }));
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
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
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
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Providers unavailable');
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'OpenAI' })).toBeEnabled();
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
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'OpenAI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No models are available');
    expect(screen.getByRole('button', { name: 'Change provider' })).toBeEnabled();
    empty = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox')).toHaveTextContent(models[0].id);
  });

  it('does not present deployment-managed access as a personal API key', async () => {
    server.use(
      http.get(base, () =>
        HttpResponse.json({ providers: [{ provider: 'amazon-bedrock', source: 'deployment' }], orgKeyAdmin: false }),
      ),
    );
    renderWithProviders(<PersonalProviderFactoryStep modelChoice="required" onContinue={vi.fn()} />);
    expect(await screen.findByText('No API key providers available.')).toBeVisible();
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
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    expect(await screen.findByText('No API key providers available.')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Provider sign-in' }));
    expect(screen.getByRole('button', { name: 'Use GitHub Copilot connection' })).toBeEnabled();
  });
});
