// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoleImpersonationProvider, useRoleImpersonation } from '../role-impersonation-context';
import { adminPermissions, viewerPermissions } from './fixtures/role-permissions';

import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type ConsumerHandle = {
  start: (role: { id: string; name: string }) => Promise<void>;
  stop: () => void;
};

function TestConsumer({ onReady }: { onReady?: (handle: ConsumerHandle) => void }) {
  const {
    isImpersonating,
    impersonatedRole,
    impersonatedPermissions,
    isSwitching,
    startImpersonation,
    stopImpersonation,
  } = useRoleImpersonation();

  if (onReady) {
    onReady({ start: startImpersonation, stop: stopImpersonation });
  }

  return (
    <div>
      <div data-testid="is-impersonating">{String(isImpersonating)}</div>
      <div data-testid="is-switching">{String(isSwitching)}</div>
      <div data-testid="impersonated-role-id">{impersonatedRole?.id ?? 'null'}</div>
      <div data-testid="impersonated-role-name">{impersonatedRole?.name ?? 'null'}</div>
      <div data-testid="impersonated-permissions">
        {impersonatedPermissions === null ? 'null' : JSON.stringify(impersonatedPermissions)}
      </div>
    </div>
  );
}

type RenderOptions = {
  apiPrefix?: string;
  headers?: Record<string, string>;
  withProvider?: boolean;
};

function renderConsumer(options: RenderOptions = {}): {
  handle: { current: ConsumerHandle | null };
  unmount: () => void;
} {
  const { apiPrefix, headers, withProvider = true } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const handleRef: { current: ConsumerHandle | null } = { current: null };
  const consumer = <TestConsumer onReady={h => (handleRef.current = h)} />;

  const wrapped: ReactNode = withProvider ? (
    <RoleImpersonationProvider>{consumer}</RoleImpersonationProvider>
  ) : (
    consumer
  );

  const { unmount } = render(
    <MastraReactProvider baseUrl={BASE_URL} apiPrefix={apiPrefix} headers={headers}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{wrapped}</MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { handle: handleRef, unmount };
}

afterEach(() => cleanup());

describe('RoleImpersonationProvider', () => {
  it('exposes a default non-impersonating state', () => {
    renderConsumer();

    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
    expect(screen.getByTestId('is-switching').textContent).toBe('false');
    expect(screen.getByTestId('impersonated-role-id').textContent).toBe('null');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');
  });

  it('starts impersonation on successful response', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.url);
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer();

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    await waitFor(() => expect(screen.getByTestId('is-impersonating').textContent).toBe('true'));
    expect(screen.getByTestId('impersonated-role-id').textContent).toBe('admin');
    expect(screen.getByTestId('impersonated-role-name').textContent).toBe('Admin');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe(JSON.stringify(['*']));
    expect(screen.getByTestId('is-switching').textContent).toBe('false');
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it('reflects isSwitching=true while the mutation is pending and false after success', async () => {
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      resolveGate = resolve;
    });

    server.use(
      http.get(`${BASE_URL}/api/auth/roles/viewer/permissions`, async () => {
        await gate;
        return HttpResponse.json(viewerPermissions);
      }),
    );

    const { handle } = renderConsumer();

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = handle.current!.start({ id: 'viewer', name: 'Viewer' });
    });

    await waitFor(() => expect(screen.getByTestId('is-switching').textContent).toBe('true'));
    // State must not be committed before the response resolves
    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');

    await act(async () => {
      resolveGate();
      await startPromise;
    });

    await waitFor(() => expect(screen.getByTestId('is-switching').textContent).toBe('false'));
    expect(screen.getByTestId('is-impersonating').textContent).toBe('true');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe(
      JSON.stringify(viewerPermissions.permissions),
    );
  });

  it('rejects and keeps state untouched on a 500 response', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    const { handle } = renderConsumer();

    let caught: unknown;
    await act(async () => {
      try {
        await handle.current!.start({ id: 'admin', name: 'Admin' });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Failed to fetch role permissions: 500/);

    await waitFor(() => expect(screen.getByTestId('is-switching').textContent).toBe('false'));
    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
    expect(screen.getByTestId('impersonated-role-id').textContent).toBe('null');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');
  });

  it('rejects and keeps state untouched on a 403 admin-required response', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, () =>
        HttpResponse.json({ message: 'Admin access required' }, { status: 403 }),
      ),
    );

    const { handle } = renderConsumer();

    let caught: unknown;
    await act(async () => {
      try {
        await handle.current!.start({ id: 'admin', name: 'Admin' });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/Failed to fetch role permissions: 403/);
    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');
    expect(screen.getByTestId('is-switching').textContent).toBe('false');
  });

  it('clears state when stopImpersonation is called after a successful start', async () => {
    server.use(http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, () => HttpResponse.json(adminPermissions)));

    const { handle } = renderConsumer();

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    await waitFor(() => expect(screen.getByTestId('is-impersonating').textContent).toBe('true'));

    act(() => {
      handle.current!.stop();
    });

    await waitFor(() => expect(screen.getByTestId('is-impersonating').textContent).toBe('false'));
    expect(screen.getByTestId('impersonated-role-id').textContent).toBe('null');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');
  });

  it('honors a custom apiPrefix', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/mastra/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.url);
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ apiPrefix: '/mastra' });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toBe(`${BASE_URL}/mastra/auth/roles/admin/permissions`);
  });

  it('honors an explicitly empty apiPrefix', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.url);
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ apiPrefix: '' });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toBe(`${BASE_URL}/auth/roles/admin/permissions`);
  });

  it('strips a trailing slash from apiPrefix', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/mastra/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.url);
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ apiPrefix: '/mastra/' });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toBe(`${BASE_URL}/mastra/auth/roles/admin/permissions`);
  });

  it('adds a leading slash when apiPrefix has none', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/mastra/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.url);
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ apiPrefix: 'mastra' });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toBe(`${BASE_URL}/mastra/auth/roles/admin/permissions`);
  });

  it('URL-encodes the roleId', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/:roleId/permissions`, ({ request, params }) => {
        onRequest(request.url, params.roleId);
        return HttpResponse.json({ roleId: 'role with spaces', permissions: [] });
      }),
    );

    const { handle } = renderConsumer();

    await act(async () => {
      await handle.current!.start({ id: 'role with spaces', name: 'Weird' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toContain('role%20with%20spaces');
  });

  it('forwards client.options.headers on the request', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(Object.fromEntries(request.headers));
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ headers: { 'x-tenant-id': 'tenant-1' } });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    const headers = onRequest.mock.calls[0]![0] as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('tenant-1');
  });

  it('does not let client headers override Content-Type', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/auth/roles/admin/permissions`, ({ request }) => {
        onRequest(request.headers.get('content-type'));
        return HttpResponse.json(adminPermissions);
      }),
    );

    const { handle } = renderConsumer({ headers: { 'Content-Type': 'text/plain' } });

    await act(async () => {
      await handle.current!.start({ id: 'admin', name: 'Admin' });
    });

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0]![0]).toBe('application/json');
  });

  it('returns a no-op fallback when used outside the provider', async () => {
    const { handle } = renderConsumer({ withProvider: false });

    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
    expect(screen.getByTestId('is-switching').textContent).toBe('false');
    expect(screen.getByTestId('impersonated-role-id').textContent).toBe('null');
    expect(screen.getByTestId('impersonated-permissions').textContent).toBe('null');

    // Calling start outside the provider should resolve without ever
    // hitting the network. No MSW handler is registered, so any call would
    // explode under `onUnhandledRequest: 'error'`.
    await expect(handle.current!.start({ id: 'admin', name: 'Admin' })).resolves.toBeUndefined();
    handle.current!.stop();

    expect(screen.getByTestId('is-impersonating').textContent).toBe('false');
  });
});
