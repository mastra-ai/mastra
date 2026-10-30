import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { PoolAccountSummary, ProviderInfo } from '../../../../../../../api/types';
import { ProviderList } from '../ProviderList';
import { PROVIDERS_URL, keyUrl, openAddProvider, rowFor, saveKey, stubProviders } from './provider-list-test-utils';

const ACCOUNTS_URL = `${PROVIDERS_URL}/:provider/accounts`;

function account(
  overrides: Partial<PoolAccountSummary> & Pick<PoolAccountSummary, 'id' | 'label'>,
): PoolAccountSummary {
  return {
    providerId: 'openai',
    type: 'api-key',
    active: false,
    status: 'ok',
    createdAt: 1_000,
    priority: 0,
    ...overrides,
  };
}

const WORK = account({ id: 'openai:work', label: 'Work key', active: true, priority: 0 });
const SIDE = account({ id: 'openai:side', label: 'Side key', priority: 1, createdAt: 2_000 });
const SPARE = account({ id: 'openai:spare', label: 'Spare key', priority: 2, createdAt: 3_000 });

/** Serves the pool for each scope and records what each request sent. */
function stubPools(pools: Partial<Record<'user' | 'org', PoolAccountSummary[]>>) {
  const requests: Array<{ method: string; path: string; scope: string | null; body?: unknown }> = [];
  const record = async (request: Request) => {
    const url = new URL(request.url);
    const text = await request.text();
    const body = text ? JSON.parse(text) : undefined;
    requests.push({ method: request.method, path: url.pathname, scope: url.searchParams.get('scope'), body });
    return url.searchParams.get('scope') as 'user' | 'org';
  };
  const reply = (scope: 'user' | 'org') => HttpResponse.json({ accounts: pools[scope] ?? [] });
  server.use(
    http.get(ACCOUNTS_URL, async ({ request }) => reply(await record(request))),
    http.put(`${ACCOUNTS_URL}/order`, async ({ request }) => {
      const scope = await record(request);
      const { orderedIds } = requests.at(-1)?.body as { orderedIds: string[] };
      pools[scope] = orderedIds.map((id, priority) => ({ ...pools[scope]!.find(a => a.id === id)!, priority }));
      return reply(scope);
    }),
    http.post(`${ACCOUNTS_URL}/:accountId/activate`, async ({ request, params }) => {
      const scope = await record(request);
      pools[scope] = pools[scope]!.map(a => ({ ...a, active: a.id === params.accountId }));
      return reply(scope);
    }),
    http.patch(`${ACCOUNTS_URL}/:accountId`, async ({ request, params }) => {
      const scope = await record(request);
      const { label } = requests.at(-1)?.body as { label: string };
      pools[scope] = pools[scope]!.map(a => (a.id === params.accountId ? { ...a, label } : a));
      return reply(scope);
    }),
    http.delete(`${ACCOUNTS_URL}/:accountId`, async ({ request, params }) => {
      const scope = await record(request);
      pools[scope] = pools[scope]!.filter(a => a.id !== params.accountId);
      return reply(scope);
    }),
  );
  return requests;
}

function enableAuth() {
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
    ),
  );
}

function pool(name = 'OpenAI accounts', container: HTMLElement = document.body) {
  return within(container).findByRole('group', { name });
}

function accountRow(label: string) {
  return screen.getByRole('group', { name: label });
}

async function pickAccountAction(user: ReturnType<typeof userEvent.setup>, label: string, action: string) {
  const trigger = within(accountRow(label)).getByRole('button', { name: `${label} actions` });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

function labelsInOrder(container: HTMLElement) {
  return [WORK, SIDE, SPARE]
    .map(a => a.label)
    .filter(label => within(container).queryByRole('group', { name: label }))
    .sort((left, right) => {
      const a = within(container).getByRole('group', { name: left });
      const b = within(container).getByRole('group', { name: right });
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('provider account pools', () => {
  it('lists the personal pool in routing order with each account’s type, active state and status', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    const requests = stubPools({
      user: [
        account({ ...SPARE, status: 'auth-failed' }),
        account({ ...SIDE, type: 'oauth', status: 'cooldown', cooldownUntil: Date.now() + 60_000 }),
        WORK,
      ],
    });
    renderWithProviders(<ProviderList credentialScope="user" />);

    const accounts = await pool();
    await waitFor(() => expect(labelsInOrder(accounts)).toEqual(['Work key', 'Side key', 'Spare key']));
    expect(within(accountRow('Work key')).getByText('Active')).toBeInTheDocument();
    expect(within(accountRow('Work key')).getByText('Key saved')).toBeInTheDocument();
    expect(within(accountRow('Side key')).queryByText('Active')).not.toBeInTheDocument();
    expect(within(accountRow('Side key')).getByText('Signed in')).toBeInTheDocument();
    expect(within(accountRow('Side key')).getByText(/^Cooling down until /)).toBeInTheDocument();
    expect(within(accountRow('Spare key')).getByText('Key rejected')).toBeInTheDocument();
    expect(requests).toEqual([
      expect.objectContaining({ method: 'GET', path: '/web/config/providers/openai/accounts', scope: 'user' }),
    ]);
  });

  it('makes another account active', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    const requests = stubPools({ user: [WORK, SIDE] });
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);
    await pool();

    await pickAccountAction(user, 'Side key', 'Make active');

    await waitFor(() => expect(within(accountRow('Side key')).getByText('Active')).toBeInTheDocument());
    expect(within(accountRow('Work key')).queryByText('Active')).not.toBeInTheDocument();
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/web/config/providers/openai/accounts/openai%3Aside/activate',
        scope: 'user',
      }),
    );
  });

  it('renames an account', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    const requests = stubPools({ user: [WORK, SIDE] });
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);
    await pool();

    await pickAccountAction(user, 'Side key', 'Rename');
    const dialog = await screen.findByRole('dialog', { name: 'Rename account' });
    const input = within(dialog).getByLabelText('Account name');
    await user.clear(input);
    await user.type(input, 'Team key');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('group', { name: 'Team key' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rename account' })).not.toBeInTheDocument());
    expect(requests).toContainEqual({
      method: 'PATCH',
      path: '/web/config/providers/openai/accounts/openai%3Aside',
      scope: 'user',
      body: { label: 'Team key' },
    });
  });

  it('removes an account and folds the pool back into the provider row at one account', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    const requests = stubPools({ user: [WORK, SIDE, SPARE] });
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);
    await pool();

    await pickAccountAction(user, 'Side key', 'Remove');

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Side key' })).not.toBeInTheDocument());
    expect(accountRow('Work key')).toBeInTheDocument();
    expect(accountRow('Spare key')).toBeInTheDocument();

    await pickAccountAction(user, 'Spare key', 'Remove');

    await waitFor(() => expect(screen.queryByRole('group', { name: 'OpenAI accounts' })).not.toBeInTheDocument());
    expect(screen.queryByRole('group', { name: 'Work key' })).not.toBeInTheDocument();
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'DELETE',
        path: '/web/config/providers/openai/accounts/openai%3Aside',
        scope: 'user',
      }),
    );
  });

  it('reorders with the move buttons and sends the full new order', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    const requests = stubPools({ user: [WORK, SIDE, SPARE] });
    const user = userEvent.setup();
    const { client } = renderWithProviders(<ProviderList credentialScope="user" />);
    const accounts = await pool();
    expect(within(accountRow('Work key')).getByRole('button', { name: 'Move Work key up' })).toBeDisabled();
    expect(within(accountRow('Spare key')).getByRole('button', { name: 'Move Spare key down' })).toBeDisabled();

    await user.click(within(accountRow('Spare key')).getByRole('button', { name: 'Move Spare key up' }));
    await waitForMutationsIdle(client);

    expect(requests).toContainEqual({
      method: 'PUT',
      path: '/web/config/providers/openai/accounts/order',
      scope: 'user',
      body: { orderedIds: ['openai:work', 'openai:spare', 'openai:side'] },
    });
    await waitFor(() => expect(labelsInOrder(accounts)).toEqual(['Work key', 'Spare key', 'Side key']));

    await user.click(within(accountRow('Spare key')).getByRole('button', { name: 'Move Spare key up' }));
    await waitForMutationsIdle(client);
    expect(requests.at(-1)?.body).toEqual({ orderedIds: ['openai:spare', 'openai:work', 'openai:side'] });
  });

  it('adds an account to an already-connected provider’s pool from "Add provider"', async () => {
    const providers: ProviderInfo[] = [{ provider: 'openai', source: 'stored' }];
    let putBody: unknown;
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ providers })));
    const pools = { user: [WORK] };
    const requests = stubPools(pools);
    server.use(
      http.put(keyUrl('openai'), async ({ request }) => {
        putBody = await request.json();
        pools.user = [WORK, account({ id: 'openai:new', label: 'OpenAI account 2', priority: 1, createdAt: 5_000 })];
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProviderList credentialScope="user" />);
    expect(await screen.findByRole('button', { name: 'OpenAI actions' })).toBeInTheDocument();
    await waitFor(() => expect(requests.map(request => request.method)).toEqual(['GET']));
    expect(screen.queryByRole('group', { name: 'OpenAI accounts' })).not.toBeInTheDocument();

    const dialog = await openAddProvider(user);
    await user.type(within(dialog).getByLabelText('Search providers'), 'openai');
    await user.click(within(dialog).getByRole('button', { name: 'Add API key for OpenAI' }));
    await saveKey(user, 'sk-second');

    await waitFor(() => expect(putBody).toMatchObject({ key: 'sk-second' }));
    expect(await screen.findByRole('group', { name: 'OpenAI account 2' })).toBeInTheDocument();
    expect(accountRow('Work key')).toBeInTheDocument();
  });

  it('names the active account in sign-out once several accounts share the pool', async () => {
    const signedIn: ProviderInfo = {
      provider: 'openai',
      source: 'oauth-user',
      userCredential: 'oauth',
      oauth: { supported: true, modes: ['paste-code'] },
    };
    server.use(http.get(PROVIDERS_URL, () => HttpResponse.json({ providers: [signedIn] })));
    const pools = { user: [account({ id: 'openai:max', label: 'Work Max', type: 'oauth', active: true })] };
    stubPools(pools);
    const user = userEvent.setup();
    const { client } = renderWithProviders(<ProviderList credentialScope="user" />);

    await user.click(await screen.findByRole('button', { name: 'OpenAI actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    pools.user = [...pools.user, SIDE];
    await client.invalidateQueries({ queryKey: ['providers'] });
    await pool();

    await user.click(screen.getByRole('button', { name: 'OpenAI actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Sign out of Work Max' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByText(/Signing out removes only the active account/)).toBeInTheDocument();
  });

  it('confirms that removing a key drops only that API key, never a sign-in', async () => {
    stubProviders([{ provider: 'openai', source: 'stored' }]);
    stubPools({ user: [WORK, SIDE] });
    const deletes: string[] = [];
    server.use(
      http.delete(keyUrl('openai'), ({ request }) => {
        deletes.push(new URL(request.url).searchParams.get('scope') ?? '');
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<ProviderList credentialScope="user" />);
    await pool();

    await user.click(screen.getByRole('button', { name: 'OpenAI actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove API key' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Work key?' });
    expect(within(dialog).getByText(/removes only this API key. OpenAI sign-ins stay connected./)).toBeInTheDocument();
    expect(within(dialog).getByText(/next account in the order becomes active/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(deletes).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'OpenAI actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove API key' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove key' }));
    await waitForMutationsIdle(client);
    expect(deletes).toHaveLength(1);
  });

  describe('org scope', () => {
    it('reads the org pool at org scope and lets admins manage it', async () => {
      enableAuth();
      stubProviders([{ provider: 'openai', source: 'stored-org', orgKey: true, orgCredential: 'api_key' }], true);
      const requests = stubPools({ org: [WORK, SIDE] });
      const user = userEvent.setup();
      renderWithProviders(<ProviderList credentialScope="org" />);
      await pool();

      await pickAccountAction(user, 'Side key', 'Make active');

      await waitFor(() => expect(within(accountRow('Side key')).getByText('Active')).toBeInTheDocument());
      expect(requests.map(request => `${request.method} ${request.scope}`)).toEqual(['GET org', 'POST org']);
    });

    it('shows members the org pool without any controls', async () => {
      enableAuth();
      stubProviders([{ provider: 'openai', source: 'stored-org', orgKey: true, orgCredential: 'api_key' }], false);
      const mutation = vi.fn();
      stubPools({ org: [WORK, SIDE] });
      server.use(
        http.post(`${ACCOUNTS_URL}/:accountId/activate`, mutation),
        http.put(`${ACCOUNTS_URL}/order`, mutation),
      );
      renderWithProviders(<ProviderList credentialScope="org" />);

      const accounts = await pool();
      await waitFor(() => expect(labelsInOrder(accounts)).toEqual(['Work key', 'Side key']));
      expect(within(accounts).queryByRole('button', { name: /actions$/ })).not.toBeInTheDocument();
      expect(within(accounts).queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
      expect(within(accounts).queryByLabelText(/^Drag /)).not.toBeInTheDocument();
      expect(within(rowFor('openai')).getByRole('button', { name: 'OpenAI actions' })).toBeDisabled();
      expect(mutation).not.toHaveBeenCalled();
    });
  });
});
