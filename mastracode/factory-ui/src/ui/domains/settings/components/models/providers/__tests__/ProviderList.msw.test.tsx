import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../../e2e/ui/render';
import type { CustomProviderInfo, OAuthStartResponse, ProviderInfo } from '../../../../../../../api/types';
import { useAvailableModelsQuery } from '../../../../../../../hooks/useAvailableModels';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { ProviderList } from '../ProviderList';
import {
  CUSTOM_PROVIDERS_URL,
  PROVIDERS_URL,
  customProviderUrl,
  fillCustomEndpoint,
  findCustomRow,
  keyUrl,
  oauthUrl,
  openAddProvider,
  openCustomEndpointForm,
  pasteCodeSession,
  pickCustomRowAction,
  pickRowAction,
  rowFor,
  saveKey,
  stubCustomProviders,
  stubProviders,
} from './provider-list-test-utils';

const deviceCodeSession = (sessionId: string, userCode: string, nextPollMs: number): OAuthStartResponse => ({
  sessionId,
  kind: 'device-code',
  url: 'https://example.com/device',
  userCode,
  instructions: 'Enter this code.',
  expiresAt: Date.now() + 60_000,
  nextPollMs,
});

describe('ProviderList', () => {
  it('shows a skeleton while loading, then only the connected providers', async () => {
    server.use(
      http.get(PROVIDERS_URL, async () => {
        await delay(100);
        return HttpResponse.json({
          providers: [
            { provider: 'openai', source: 'stored' },
            { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
          ],
        });
      }),
    );

    renderWithProviders(<ProviderList credentialScope="user" />);

    expect(await screen.findByRole('status', { name: 'Loading providers' })).toBeInTheDocument();
    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument();
    expect(screen.queryByText('Anthropic')).not.toBeInTheDocument();
  });

  it('surfaces a provider list error', async () => {
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

    renderWithProviders(<ProviderList credentialScope="user" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
  });

  it('offers sign-in providers first and finds API-key providers by search', async () => {
    stubProviders([
      { provider: 'openai', source: 'none' },
      { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
      { provider: 'google', source: 'none' },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    expect(within(dialog).getByText('Anthropic')).toBeInTheDocument();
    expect(within(dialog).queryByText('OpenAI')).not.toBeInTheDocument();
    expect(within(dialog).getByText('2 more take an API key. Type to find one.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Search providers'), 'open');
    expect(within(dialog).getByText('OpenAI')).toBeInTheDocument();
    expect(within(dialog).queryByText('Anthropic')).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Search providers'), 'zzz');
    expect(within(dialog).getByText('No providers match “openzzz”.')).toBeInTheDocument();
  });

  it('saves an API key found in the add dialog and refetches the model catalog', async () => {
    const providers: ProviderInfo[] = [{ provider: 'openai', source: 'none', envVar: 'OPENAI_API_KEY' }];
    const models: AvailableModelOption[] = [];
    let putBody: unknown;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json({ models })),
      http.put(keyUrl('openai'), async ({ request }) => {
        putBody = await request.json();
        providers[0] = { provider: 'openai', source: 'stored', envVar: 'OPENAI_API_KEY' };
        models.push({ id: 'openai/gpt-4o', provider: 'openai', modelName: 'gpt-4o', hasApiKey: true });
        return HttpResponse.json({ ok: true });
      }),
    );

    function ModelCatalogProbe() {
      const query = useAvailableModelsQuery();
      return <output aria-label="Model catalog">{(query.data ?? []).map(model => model.id).join(',')}</output>;
    }

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <ProviderList credentialScope="user" />
        <ModelCatalogProbe />
      </>,
    );

    const dialog = await openAddProvider(user);
    await user.type(within(dialog).getByLabelText('Search providers'), 'openai');
    await user.click(within(dialog).getByRole('button', { name: 'Add API key for OpenAI' }));
    await saveKey(user, 'sk-test');

    await waitFor(() => expect(putBody).toEqual({ key: 'sk-test', envVar: 'OPENAI_API_KEY' }));
    await waitFor(() => expect(within(rowFor('openai')).getByText('Key saved')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Model catalog' })).toHaveTextContent('openai/gpt-4o'),
    );
  });

  it('shows a removing key as pending with its menu locked, then drops the row', async () => {
    const providers: ProviderInfo[] = [{ provider: 'openai', source: 'stored' }];
    let releaseDelete = () => {};
    const deleteHeld = new Promise<void>(resolve => {
      releaseDelete = resolve;
    });
    let removed = false;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.delete(keyUrl('openai'), async () => {
        removed = true;
        await deleteHeld;
        providers.length = 0;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await screen.findByText('OpenAI');
    await pickRowAction(user, 'openai', 'Remove key');

    await waitFor(() => expect(removed).toBe(true));
    expect(within(rowFor('openai')).getByText('Removing…')).toBeInTheDocument();
    expect(within(rowFor('openai')).getByRole('button', { name: 'OpenAI actions' })).toBeDisabled();

    releaseDelete();
    await waitFor(() => expect(screen.queryByText('OpenAI')).not.toBeInTheDocument());
  });

  it('signs in with a paste code from the add dialog', async () => {
    const providers: ProviderInfo[] = [
      { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
    ];
    let startBody: unknown;
    let completeBody: unknown;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.post(oauthUrl('anthropic', 'start'), async ({ request }) => {
        startBody = await request.json();
        return HttpResponse.json(pasteCodeSession('session-1'));
      }),
      http.post(oauthUrl('anthropic', 'complete'), async ({ request }) => {
        completeBody = await request.json();
        providers[0] = { ...providers[0], source: 'oauth-user' };
        return HttpResponse.json({ status: 'complete', ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign in to Anthropic' }));
    await user.type(await screen.findByLabelText('Authorization code'), 'code#state');
    await user.click(screen.getByRole('button', { name: 'Complete sign in' }));

    expect(startBody).toEqual({ mode: 'paste-code' });
    await waitFor(() => expect(completeBody).toEqual({ sessionId: 'session-1', code: 'code#state' }));
    await waitFor(() => expect(within(rowFor('anthropic')).getByText('Signed in')).toBeInTheDocument());
  });

  it('shows a failed sign-in start in the add dialog and forgets it once the dialog closes', async () => {
    stubProviders([{ provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } }]);
    server.use(
      http.post(oauthUrl('anthropic', 'start'), () =>
        HttpResponse.json({ error: 'Anthropic sign-in is unavailable' }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign in to Anthropic' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Anthropic sign-in is unavailable');
    expect(within(dialog).getByRole('button', { name: 'Sign in to Anthropic' })).toBeEnabled();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add provider' })).not.toBeInTheDocument());
    const reopened = await openAddProvider(user);
    expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('polls a device-code sign-in until it completes', async () => {
    const providers: ProviderInfo[] = [
      { provider: 'xai', source: 'none', oauth: { supported: true, modes: ['device-code'] } },
    ];
    let pollCount = 0;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.post(oauthUrl('xai', 'start'), () => HttpResponse.json(deviceCodeSession('session-2', 'GROK-123', 100))),
      http.post(oauthUrl('xai', 'poll'), () => {
        pollCount += 1;
        if (pollCount === 1) return HttpResponse.json({ status: 'pending', nextPollMs: 100 });
        providers[0] = { ...providers[0], source: 'oauth-user' };
        return HttpResponse.json({ status: 'complete', ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign in to xAI' }));

    expect(await screen.findByText('GROK-123')).toBeInTheDocument();
    await waitFor(() => expect(within(rowFor('xai')).getByText('Signed in')).toBeInTheDocument());
  });

  it('closes a device-code sign-in once persisted, without a stale second poll', async () => {
    const providers: ProviderInfo[] = [
      { provider: 'openai', source: 'none', oauth: { supported: true, modes: ['device-code'] } },
    ];
    let pollCount = 0;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.post(oauthUrl('openai', 'start'), () =>
        HttpResponse.json(deviceCodeSession('session-race', 'OPENAI-123', 10)),
      ),
      http.post(oauthUrl('openai', 'poll'), async () => {
        pollCount += 1;
        if (pollCount > 1) {
          await delay(50);
          return HttpResponse.error();
        }
        await delay(20);
        providers[0] = { ...providers[0], source: 'oauth-user' };
        return HttpResponse.json({ status: 'complete', ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    await user.click(within(dialog).getByRole('button', { name: 'Sign in to OpenAI' }));

    await waitFor(() => expect(within(rowFor('openai')).getByText('Signed in')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(pollCount).toBe(1);
  });

  it('signs out from the row menu', async () => {
    const providers: ProviderInfo[] = [
      { provider: 'anthropic', source: 'oauth-user', oauth: { supported: true, modes: ['paste-code'] } },
    ];
    let signedOut = false;
    server.use(
      http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })),
      http.delete(`${PROVIDERS_URL}/anthropic/oauth`, () => {
        signedOut = true;
        providers[0] = { ...providers[0], source: 'none' };
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await screen.findByText('Anthropic');
    await pickRowAction(user, 'anthropic', 'Sign out');

    await waitFor(() => expect(signedOut).toBe(true));
    await waitFor(() => expect(screen.queryByText('Anthropic')).not.toBeInTheDocument());
  });
});

describe('ProviderList custom endpoints', () => {
  const myLlm: CustomProviderInfo = {
    id: 'my-llm',
    name: 'my-llm',
    url: 'https://api.example.com/v1',
    hasApiKey: true,
    models: ['model-a', 'model-b'],
    scope: 'user',
  };

  it('lists an endpoint with its URL and model count, with its own actions instead of key actions', async () => {
    // The provider catalog reports the endpoint too; it must not also be drawn
    // as a built-in provider whose key can be updated.
    stubProviders([
      { provider: 'openai', source: 'stored' },
      { provider: 'my-llm', source: 'stored', custom: true },
    ]);
    stubCustomProviders([myLlm]);
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const row = await findCustomRow('my-llm');
    expect(within(row).getByText('https://api.example.com/v1')).toBeInTheDocument();
    expect(within(row).getByText('2 models')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /actions$/ })).toHaveLength(2);

    await user.click(within(row).getByRole('button', { name: 'my-llm actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Update key' })).not.toBeInTheDocument();
  });

  it('adds an endpoint from the Add provider dialog, even when no provider matches the search', async () => {
    const saved: CustomProviderInfo[] = [];
    let postBody: unknown;
    stubProviders([{ provider: 'openai', source: 'none' }]);
    server.use(
      http.get(CUSTOM_PROVIDERS_URL, () => HttpResponse.json({ providers: saved })),
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        postBody = await request.json();
        saved.push(myLlm);
        return HttpResponse.json({ ok: true, provider: myLlm });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const dialog = await openAddProvider(user);
    await user.type(within(dialog).getByLabelText('Search providers'), 'no-such-provider');
    expect(within(dialog).getByText(/No providers match/)).toBeInTheDocument();

    const form = await openCustomEndpointForm(user, dialog);
    await fillCustomEndpoint(user, form, {
      name: 'my-llm',
      url: 'https://api.example.com/v1',
      models: 'model-a, model-b',
    });
    await user.click(within(form).getByRole('button', { name: 'Add' }));

    // Without sign-in there is one list, so no scope is sent.
    await waitFor(() =>
      expect(postBody).toEqual({
        name: 'my-llm',
        url: 'https://api.example.com/v1',
        models: ['model-a', 'model-b'],
      }),
    );
    expect(await findCustomRow('my-llm')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the form open with the server message when saving fails', async () => {
    stubProviders([{ provider: 'openai', source: 'none' }]);
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, () =>
        HttpResponse.json(
          { error: 'provider_name_taken', message: '"OpenAI" is already a built-in provider. Choose another name.' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const form = await openCustomEndpointForm(user, await openAddProvider(user));
    await fillCustomEndpoint(user, form, { name: 'OpenAI', url: 'https://proxy.example.com/v1', models: 'gpt' });
    await user.click(within(form).getByRole('button', { name: 'Add' }));

    expect(await within(form).findByText(/already a built-in provider/)).toBeInTheDocument();
  });

  it('edits an endpoint without sending its key again', async () => {
    let postBody: unknown;
    stubProviders([]);
    stubCustomProviders([myLlm]);
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({ ok: true, provider: { ...myLlm, url: 'https://moved.example.com/v1' } });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Edit');
    const form = await screen.findByRole('dialog', { name: 'Edit my-llm' });
    const url = within(form).getByPlaceholderText('https://api.example.com/v1');
    await user.clear(url);
    await user.type(url, 'https://moved.example.com/v1');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(postBody).toEqual({
        name: 'my-llm',
        url: 'https://moved.example.com/v1',
        models: ['model-a', 'model-b'],
        previousId: 'my-llm',
      }),
    );
  });

  it('removes an endpoint from its row menu', async () => {
    const saved: CustomProviderInfo[] = [myLlm];
    let removedWith: string | undefined;
    stubProviders([]);
    server.use(
      http.get(CUSTOM_PROVIDERS_URL, () => HttpResponse.json({ providers: saved })),
      http.delete(customProviderUrl('my-llm'), ({ request }) => {
        removedWith = new URL(request.url).search;
        saved.length = 0;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Remove');

    await waitFor(() => expect(removedWith).toBe(''));
    await waitFor(() => expect(screen.queryByText('my-llm')).not.toBeInTheDocument());
  });
});
