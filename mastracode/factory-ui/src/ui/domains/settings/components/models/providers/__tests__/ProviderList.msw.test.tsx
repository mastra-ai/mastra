import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../../e2e/ui/render';
import type {
  CustomProviderCheckFailedResponse,
  CustomProviderCheckFailure,
  CustomProviderCheckResponse,
  CustomProviderInfo,
  OAuthStartResponse,
  ProviderInfo,
} from '../../../../../../../api/types';
import { useAvailableModelsQuery } from '../../../../../../../hooks/useAvailableModels';
import type { AvailableModelOption } from '../../../../../../../hooks/useAvailableModels';
import { ProviderList } from '../ProviderList';
import {
  CHECK_URL,
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

  it('connects the Mastra Gateway in one click and offers to add credits when the organization has none', async () => {
    let connected = false;
    server.use(
      http.get(PROVIDERS_URL, () =>
        HttpResponse.json({
          providers: [
            connected
              ? { provider: 'mastra', source: 'stored-user', userCredential: 'api_key', connectWithMastraAccount: true }
              : { provider: 'mastra', source: 'none', connectWithMastraAccount: true },
            { provider: 'anthropic', source: 'none', oauth: { supported: true, modes: ['paste-code'] } },
          ],
        }),
      ),
      http.post(`${PROVIDERS_URL}/mastra/connect`, () => {
        connected = true;
        return HttpResponse.json({ ok: true });
      }),
      http.get(`${PROVIDERS_URL}/mastra/credits`, () =>
        HttpResponse.json({
          remaining: 0,
          unlimited: false,
          canAddCredits: true,
          addCreditsUrl: 'https://projects.mastra.ai/add-credits/org-1',
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const drawer = await openAddProvider(user);
    expect(await within(drawer).findByText('Pay with your organization’s Mastra credits ($0.00 left)')).toBeVisible();
    await user.click(within(drawer).getByRole('button', { name: 'Connect Mastra Gateway' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add provider' })).not.toBeInTheDocument());
    expect(await screen.findByText('No gateway credits left')).toBeInTheDocument();
    expect(within(rowFor('mastra')).getByText('Key saved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add credits' })).toHaveAttribute(
      'href',
      'https://projects.mastra.ai/add-credits/org-1',
    );
  });

  it('lets the user remove the Mastra Gateway key Factory created, but not replace it', async () => {
    stubProviders([
      { provider: 'mastra', source: 'stored-user', userCredential: 'api_key', connectWithMastraAccount: true },
    ]);
    server.use(
      http.get(`${PROVIDERS_URL}/mastra/credits`, () =>
        HttpResponse.json({
          remaining: 5,
          unlimited: false,
          canAddCredits: true,
          addCreditsUrl: 'https://projects.mastra.ai/add-credits/org-1',
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await user.click(await screen.findByRole('button', { name: 'Mastra Gateway actions' }));

    expect(await screen.findByRole('menuitem', { name: 'Remove key' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Update key' })).not.toBeInTheDocument();
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
    authScheme: 'bearer',
    headers: [],
    models: ['model-a', 'model-b'],
    scope: 'user',
    lastCheck: { at: '2026-11-26T10:00:00.000Z', ok: true },
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

  it('marks an endpoint this server refuses to call and keeps it editable', async () => {
    stubProviders([]);
    stubCustomProviders([
      {
        ...myLlm,
        url: 'http://10.0.0.5/v1',
        urlProblem: 'Use an HTTPS address: a hosted Factory only calls custom endpoints over HTTPS.',
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    const row = await findCustomRow('my-llm');
    expect(within(row).getByText('URL not allowed')).toBeInTheDocument();
    expect(within(row).queryByText('2 models')).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'my-llm actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
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
      models: ['model-a', 'model-b'],
    });
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    await waitFor(() =>
      expect(postBody).toEqual({
        name: 'my-llm',
        url: 'https://api.example.com/v1',
        authScheme: 'bearer',
        headers: [],
        models: ['model-a', 'model-b'],
        scope: 'user',
        check: true,
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
    await fillCustomEndpoint(user, form, { name: 'OpenAI', url: 'https://proxy.example.com/v1', models: ['gpt'] });
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    expect(await within(form).findByText(/already a built-in provider/)).toBeInTheDocument();
  });

  it('edits an endpoint without sending its key again', async () => {
    let postBody: unknown;
    stubProviders([]);
    stubCustomProviders([myLlm]);
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({ ok: true, provider: { ...myLlm, url: 'https://api.example.com/v2' } });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Edit');
    const form = await screen.findByRole('dialog', { name: 'Edit my-llm' });
    const url = within(form).getByPlaceholderText('https://api.example.com/v1');
    await user.clear(url);
    await user.type(url, 'https://api.example.com/v2');
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    await waitFor(() =>
      expect(postBody).toEqual({
        name: 'my-llm',
        url: 'https://api.example.com/v2',
        authScheme: 'bearer',
        headers: [],
        models: ['model-a', 'model-b'],
        previousId: 'my-llm',
        scope: 'user',
        check: true,
      }),
    );
  });

  it('keeps the form open and asks for the key when the server needs it again', async () => {
    stubProviders([]);
    stubCustomProviders([myLlm]);
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, () =>
        HttpResponse.json(
          {
            error: 'api_key_required',
            message: 'Enter the API key again: the saved key is only kept while the URL stays on the same host.',
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Edit');
    const form = await screen.findByRole('dialog', { name: 'Edit my-llm' });
    const url = within(form).getByPlaceholderText('https://api.example.com/v1');
    await user.clear(url);
    await user.type(url, 'https://elsewhere.example.com/v1');
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    expect(await within(form).findByText(/Enter the API key again/)).toBeInTheDocument();
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

    await waitFor(() => expect(removedWith).toBe('?scope=user'));
    await waitFor(() => expect(screen.queryByText('my-llm')).not.toBeInTheDocument());
  });

  it.each([
    {
      state: 'never tested',
      lastCheck: undefined,
      status: 'Not verified',
      reason: undefined,
    },
    {
      state: 'that failed its last test',
      lastCheck: {
        at: '2026-11-26T10:00:00.000Z',
        ok: false,
        message: 'HTTP 401 Unauthorized from https://api.example.com/v1/models',
      },
      status: 'Check failed',
      reason: 'HTTP 401 Unauthorized from https://api.example.com/v1/models',
    },
  ])('shows an endpoint $state as unverified, never as connected', async ({ lastCheck, status, reason }) => {
    stubProviders([]);
    stubCustomProviders([{ ...myLlm, lastCheck }]);
    renderWithProviders(<ProviderList credentialScope="user" />);

    const row = await findCustomRow('my-llm');
    expect(within(row).getByText(status)).toBeInTheDocument();
    expect(within(row).queryByText('2 models')).not.toBeInTheDocument();
    if (reason) expect(within(row).getByText(reason)).toBeInTheDocument();
  });

  it('tests a saved endpoint from its row menu and shows the recorded result', async () => {
    let saved: CustomProviderInfo = { ...myLlm, lastCheck: undefined };
    let checkBody: unknown;
    const failure: CustomProviderCheckFailure = {
      kind: 'http',
      status: 403,
      message: 'HTTP 403 Forbidden from https://api.example.com/v1/models',
    };
    stubProviders([]);
    server.use(
      http.get(CUSTOM_PROVIDERS_URL, () => HttpResponse.json({ providers: [saved] })),
      http.post(CHECK_URL, async ({ request }) => {
        checkBody = await request.json();
        saved = { ...saved, lastCheck: { at: '2026-11-26T10:00:00.000Z', ok: false, message: failure.message } };
        const response: CustomProviderCheckResponse = {
          ok: true,
          check: { models: { ok: false, failure, latencyMs: 30 } },
          provider: saved,
        };
        return HttpResponse.json(response);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    expect(within(await findCustomRow('my-llm')).getByText('Not verified')).toBeInTheDocument();
    await pickCustomRowAction(user, 'my-llm', 'Test connection');

    await waitFor(() => expect(within(rowForCustom()).getByText('Check failed')).toBeInTheDocument());
    expect(within(rowForCustom()).getByText(failure.message)).toBeInTheDocument();
    expect(checkBody).toEqual({ previousId: 'my-llm', scope: 'user' });
  });
});

/** The row of the `my-llm` endpoint, read again after a refetch replaces it. */
function rowForCustom(): HTMLElement {
  const row = screen.getByText('my-llm').closest('li');
  if (!(row instanceof HTMLElement)) throw new Error('Custom endpoint row not found for my-llm');
  return row;
}

describe('Custom endpoint form', () => {
  const URL_UNDER_TEST = 'https://api.example.com/v1';

  /** Opens the form for a new endpoint from the Add provider dialog. */
  async function openNewEndpointForm() {
    stubProviders([{ provider: 'openai', source: 'none' }]);
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);
    const form = await openCustomEndpointForm(user, await openAddProvider(user));
    return { user, form };
  }

  /** Records every save request and answers it with the saved endpoint. */
  function recordSaves() {
    const bodies: unknown[] = [];
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        bodies.push(await request.json());
        const provider: CustomProviderInfo = {
          id: 'my-llm',
          name: 'my-llm',
          url: URL_UNDER_TEST,
          hasApiKey: false,
          authScheme: 'bearer',
          headers: [],
          models: [],
          scope: 'user',
        };
        return HttpResponse.json({ ok: true, provider });
      }),
    );
    return bodies;
  }

  it('lists the endpoint models after Test for the user to pick, keeping an id they typed', async () => {
    let checkBody: unknown;
    const listed: CustomProviderCheckResponse = {
      ok: true,
      check: { models: { ok: true, models: ['gpt-a', 'gpt-b', 'gpt-c'], latencyMs: 85 } },
    };
    server.use(
      http.post(CHECK_URL, async ({ request }) => {
        checkBody = await request.json();
        return HttpResponse.json(listed);
      }),
    );
    const saves = recordSaves();
    const { user, form } = await openNewEndpointForm();

    await fillCustomEndpoint(user, form, { name: 'my-llm', url: URL_UNDER_TEST, models: ['my-finetune'] });
    await user.type(within(form).getByPlaceholderText('Paste API key'), 'sk-test');
    await user.click(within(form).getByRole('button', { name: 'Test' }));

    expect(
      await within(form).findByText('Endpoint answered in 85 ms and lists 3 models. This check does not call a model.'),
    ).toBeInTheDocument();
    expect(checkBody).toEqual({
      url: URL_UNDER_TEST,
      apiKey: 'sk-test',
      authScheme: 'bearer',
      headers: [],
      scope: 'user',
    });
    // Listed ids are offered, not picked for the user.
    expect(within(form).queryByRole('button', { name: 'Remove gpt-a' })).not.toBeInTheDocument();
    expect(within(form).getByText('Not listed by the endpoint: my-finetune.')).toBeInTheDocument();

    await user.click(within(form).getByRole('combobox', { name: 'Models' }));
    await user.click(await screen.findByRole('option', { name: 'gpt-b' }));
    await user.keyboard('{Escape}');
    await user.click(within(form).getByRole('button', { name: 'Add all 2 listed models' }));
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ name: 'my-llm', check: true });
    expect(modelsOf(saves[0])).toEqual(['gpt-a', 'gpt-b', 'gpt-c', 'my-finetune']);
  });

  it('marks a test result out of date once the connection settings change', async () => {
    const listed: CustomProviderCheckResponse = {
      ok: true,
      check: { models: { ok: true, models: ['gpt-a'], latencyMs: 12 } },
    };
    server.use(http.post(CHECK_URL, () => HttpResponse.json(listed)));
    const { user, form } = await openNewEndpointForm();

    await user.type(within(form).getByPlaceholderText('https://api.example.com/v1'), URL_UNDER_TEST);
    await user.click(within(form).getByRole('button', { name: 'Test' }));
    expect(await within(form).findByText(/Endpoint answered in 12 ms/)).toBeInTheDocument();

    await user.type(within(form).getByPlaceholderText('Paste API key'), 'sk-other');

    expect(within(form).queryByText(/Endpoint answered in 12 ms/)).not.toBeInTheDocument();
    expect(
      within(form).getByText('The settings changed after the last test. Test again to check them.'),
    ).toBeInTheDocument();
  });

  it('shows the upstream status and detail when the test fails', async () => {
    const failed: CustomProviderCheckResponse = {
      ok: true,
      check: {
        models: {
          ok: false,
          latencyMs: 40,
          failure: {
            kind: 'http',
            status: 403,
            message: 'HTTP 403 Forbidden from https://api.example.com/v1/models',
            detail: 'Access denied Your IP is not on the allow list for this gateway.',
          },
        },
      },
    };
    server.use(http.post(CHECK_URL, () => HttpResponse.json(failed)));
    const { user, form } = await openNewEndpointForm();

    await user.type(within(form).getByPlaceholderText('https://api.example.com/v1'), URL_UNDER_TEST);
    await user.click(within(form).getByRole('button', { name: 'Test' }));

    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('HTTP 403 Forbidden from https://api.example.com/v1/models');
    expect(alert).toHaveTextContent('Access denied Your IP is not on the allow list for this gateway.');
    expect(within(form).queryByRole('button', { name: 'Save anyway' })).not.toBeInTheDocument();
  });

  it('saves nothing when Test & save fails, then saves untested with Save anyway', async () => {
    const bodies: unknown[] = [];
    const failure: CustomProviderCheckFailure = {
      kind: 'network',
      message: 'Could not reach https://api.example.com/v1/models: ENOTFOUND',
    };
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        const body = await request.json();
        bodies.push(body);
        if (body && typeof body === 'object' && 'check' in body) {
          const refused: CustomProviderCheckFailedResponse = {
            error: 'custom_endpoint_check_failed',
            message: 'The connection test failed, so the provider was not saved.',
            failure,
          };
          return HttpResponse.json(refused, { status: 422 });
        }
        const provider: CustomProviderInfo = {
          id: 'my-llm',
          name: 'my-llm',
          url: URL_UNDER_TEST,
          hasApiKey: false,
          authScheme: 'bearer',
          headers: [],
          models: ['m'],
          scope: 'user',
        };
        return HttpResponse.json({ ok: true, provider });
      }),
    );
    const { user, form } = await openNewEndpointForm();

    await fillCustomEndpoint(user, form, { name: 'my-llm', url: URL_UNDER_TEST, models: ['m'] });
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(failure.message);
    expect(within(form).getByText(/Nothing was saved/)).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Save anyway' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add custom endpoint' })).not.toBeInTheDocument());
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ check: true });
    expect(bodies[1]).toEqual({
      name: 'my-llm',
      url: URL_UNDER_TEST,
      authScheme: 'bearer',
      headers: [],
      models: ['m'],
      scope: 'user',
    });
  });

  it('sends a test message to a chosen model and shows its reply', async () => {
    let checkBody: unknown;
    const replied: CustomProviderCheckResponse = {
      ok: true,
      check: {
        models: { ok: true, models: ['m'], latencyMs: 10 },
        reply: { ok: true, reply: 'yes', finishReason: 'stop', latencyMs: 640 },
      },
    };
    server.use(
      http.post(CHECK_URL, async ({ request }) => {
        checkBody = await request.json();
        return HttpResponse.json(replied);
      }),
    );
    const { user, form } = await openNewEndpointForm();

    await fillCustomEndpoint(user, form, { name: 'my-llm', url: URL_UNDER_TEST, models: ['m'] });
    await user.click(within(form).getByRole('button', { name: 'Send test message' }));

    expect(await within(form).findByText('m replied in 640 ms')).toBeInTheDocument();
    expect(within(form).getByText('yes')).toBeInTheDocument();
    expect(checkBody).toMatchObject({ url: URL_UNDER_TEST, model: 'm' });
  });

  it('adds a custom header that starts secret and can be made plain', async () => {
    const saves = recordSaves();
    const { user, form } = await openNewEndpointForm();

    await fillCustomEndpoint(user, form, { name: 'my-llm', url: URL_UNDER_TEST, models: ['m'] });
    await user.click(within(form).getByRole('button', { name: 'Auth scheme and headers' }));
    await user.click(within(form).getByRole('button', { name: 'Add header' }));
    await user.type(within(form).getByRole('textbox', { name: 'Header 1 name' }), 'X-Org');
    const secretToggle = within(form).getByRole('button', { name: 'Header 1 is secret' });
    expect(secretToggle).toHaveAttribute('aria-pressed', 'true');
    // A secret value is masked while it is typed.
    expect(within(form).getByLabelText('Header 1 value')).toHaveAttribute('type', 'password');
    await user.type(within(form).getByLabelText('Header 1 value'), 'org-7');
    await user.click(within(form).getByRole('button', { name: 'Add header' }));
    await user.type(within(form).getByRole('textbox', { name: 'Header 2 name' }), 'X-Team');
    await user.type(within(form).getByLabelText('Header 2 value'), 'research');
    await user.click(within(form).getByRole('button', { name: 'Header 2 is secret' }));
    expect(within(form).getByRole('button', { name: 'Header 2 is secret' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({
      headers: [
        { name: 'X-Org', value: 'org-7', secret: true },
        { name: 'X-Team', value: 'research', secret: false },
      ],
    });
  });

  it('keeps a saved secret header on edit without sending a value for it', async () => {
    let postBody: unknown;
    const withHeaders: CustomProviderInfo = {
      id: 'my-llm',
      name: 'my-llm',
      url: URL_UNDER_TEST,
      hasApiKey: true,
      authScheme: 'x-api-key',
      headers: [
        { name: 'X-Org', secret: true },
        { name: 'X-Team', secret: false, value: 'research' },
      ],
      models: ['m'],
      scope: 'user',
    };
    stubProviders([]);
    stubCustomProviders([withHeaders]);
    server.use(
      http.post(CUSTOM_PROVIDERS_URL, async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({ ok: true, provider: withHeaders });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Edit');
    const form = await screen.findByRole('dialog', { name: 'Edit my-llm' });
    // A provider that already sends headers opens with them in view.
    const savedSecret = within(form).getByLabelText('Header 1 value');
    expect(savedSecret).toHaveValue('');
    expect(savedSecret).toHaveAttribute('placeholder', 'Saved. Type to replace.');
    expect(within(form).getByLabelText('Header 2 value')).toHaveValue('research');
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    // `objectContaining` compares `headers` exactly, so a value sent for X-Org fails it.
    await waitFor(() =>
      expect(postBody).toEqual(
        expect.objectContaining({
          authScheme: 'x-api-key',
          headers: [
            { name: 'X-Org', secret: true },
            { name: 'X-Team', value: 'research', secret: false },
          ],
        }),
      ),
    );
  });

  it('asks for a value before a saved secret header is made plain', async () => {
    const withSecret: CustomProviderInfo = {
      id: 'my-llm',
      name: 'my-llm',
      url: URL_UNDER_TEST,
      hasApiKey: true,
      authScheme: 'bearer',
      headers: [{ name: 'X-Org', secret: true }],
      models: ['m'],
      scope: 'user',
    };
    stubProviders([]);
    stubCustomProviders([withSecret]);
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);

    await pickCustomRowAction(user, 'my-llm', 'Edit');
    const form = await screen.findByRole('dialog', { name: 'Edit my-llm' });
    await user.click(within(form).getByRole('button', { name: 'Header 1 is secret' }));
    await user.click(within(form).getByRole('button', { name: 'Test & save' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('Enter a value for X-Org to make it plain.');
  });
});

/** The `models` a save request sent, sorted, since the order picks were made in is not part of the contract. */
function modelsOf(body: unknown): string[] {
  if (!body || typeof body !== 'object' || !('models' in body) || !Array.isArray(body.models)) return [];
  return body.models.filter((model): model is string => typeof model === 'string').toSorted();
}
