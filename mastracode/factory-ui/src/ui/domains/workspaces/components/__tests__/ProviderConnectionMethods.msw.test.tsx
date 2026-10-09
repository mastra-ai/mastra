import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ProviderInfo } from '../../../../../api/types';
import { ModelProviderFactoryStep } from '../ModelProviderFactoryStep';
import { PersonalProviderFactoryStep } from '../PersonalProviderFactoryStep';

const base = `${TEST_BASE_URL}/web/config/providers`;
beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
  );
});

function registerProvider(provider: () => ProviderInfo) {
  server.use(
    http.get(base, () => HttpResponse.json({ providers: [provider()], orgKeyAdmin: true })),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true },
        ],
      }),
    ),
  );
}

const anthropic: ProviderInfo = {
  provider: 'anthropic',
  source: 'none',
  envVar: 'ANTHROPIC_API_KEY',
  oauth: { supported: true, modes: ['paste-code'] },
};

describe('provider method and scope are independent choices', () => {
  it('offers an organization API key even when the provider supports sign-in', async () => {
    let saved = false;
    registerProvider(() => ({
      ...anthropic,
      source: saved ? 'stored-org' : 'none',
      ...(saved ? { orgCredential: 'api_key' } : {}),
    }));
    const writes: unknown[] = [];
    server.use(
      http.put(`${base}/anthropic/key`, async ({ request }) => {
        writes.push(await request.json());
        saved = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Everyone in your organization can use this key.')).toBeInTheDocument();
    await user.type(dialog.getByLabelText('API key for Anthropic'), 'test-key');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('combobox')).toHaveTextContent('anthropic/claude-fable-5');
    expect(writes).toEqual([{ key: 'test-key', envVar: 'ANTHROPIC_API_KEY', scope: 'org' }]);
  });

  it('starts organization sign-in instead of treating an existing API key as a sign-in connection', async () => {
    registerProvider(() => ({ ...anthropic, source: 'stored-org', orgCredential: 'api_key' }));
    const starts: unknown[] = [];
    server.use(
      http.post(`${base}/anthropic/oauth/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({
          sessionId: 'sign-in-1',
          kind: 'paste-code',
          url: 'https://example.com/authorize',
          instructions: 'Paste code',
          expiresAt: Date.now() + 600_000,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ModelProviderFactoryStep onComplete={vi.fn()} />);
    await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
    await user.click(screen.getByRole('button', { name: 'Continue with Anthropic' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/Everyone in your organization.*replaces the existing connection/)).toBeInTheDocument();
    expect(starts).toEqual([{ mode: 'paste-code', scope: 'org' }]);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('connects personal sign-in without reusing or replacing the organization connection', async () => {
    let saved = false;
    registerProvider(() => ({
      ...anthropic,
      source: 'oauth-org',
      orgCredential: 'oauth',
      ...(saved ? { userCredential: 'oauth' } : {}),
    }));
    const starts: unknown[] = [];
    server.use(
      http.post(`${base}/anthropic/oauth/start`, async ({ request }) => {
        starts.push(await request.json());
        return HttpResponse.json({
          sessionId: 'sign-in-1',
          kind: 'paste-code',
          url: 'https://example.com/authorize',
          instructions: 'Paste code',
          expiresAt: Date.now() + 600_000,
        });
      }),
      http.post(`${base}/anthropic/oauth/complete`, () => {
        saved = true;
        return HttpResponse.json({ status: 'complete' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PersonalProviderFactoryStep onContinue={vi.fn()} />);
    await user.click(await screen.findByRole('tab', { name: 'Provider sign-in' }));
    await user.click(screen.getByRole('button', { name: 'Continue with Anthropic' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByText('This provider connection is only for you. Shared organization access stays unchanged.'),
    ).toBeInTheDocument();
    expect(starts).toEqual([{ mode: 'paste-code', scope: 'user' }]);
    await user.type(dialog.getByLabelText('Authorization code'), 'demo-code');
    await user.click(dialog.getByRole('button', { name: 'Complete sign in' }));
    expect(await screen.findByText('Provider sign-in · only you.')).toBeInTheDocument();
  });

  it('warns that a personal API key replaces personal sign-in and saves only at user scope', async () => {
    let saved = false;
    registerProvider(() => ({
      ...anthropic,
      source: saved ? 'stored-user' : 'oauth-user',
      orgCredential: 'api_key',
      userCredential: saved ? 'api_key' : 'oauth',
    }));
    const writes: unknown[] = [];
    server.use(
      http.put(`${base}/anthropic/key`, async ({ request }) => {
        writes.push(await request.json());
        saved = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PersonalProviderFactoryStep onContinue={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Anthropic' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Only you can use this key.*replaces the provider sign-in/)).toBeInTheDocument();
    await user.type(dialog.getByLabelText('API key for Anthropic'), 'test-key');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ key: 'test-key', envVar: 'ANTHROPIC_API_KEY', scope: 'user' }]);
    expect(screen.getByText('API key · only you.')).toBeInTheDocument();
  });
});
