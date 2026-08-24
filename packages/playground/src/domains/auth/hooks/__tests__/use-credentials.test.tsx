import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { useCredentialsLogin } from '../use-credentials-login';
import { useCredentialsSignUp } from '../use-credentials-signup';
import { server } from '@/test/msw-server';

/**
 * Tests for credentials auth hooks (sign-in, sign-up).
 *
 * Covers issue https://github.com/mastra-ai/mastra/issues/16460:
 * - useCredentialsLogin should use client.options.apiPrefix instead of hardcoded /api
 * - useCredentialsSignUp should use client.options.apiPrefix instead of hardcoded /api
 *
 * Drives the real hooks through MastraReactProvider + React Query; the network
 * is the only thing faked, via MSW. Provider props (baseUrl/apiPrefix/headers)
 * configure the real MastraClient, and MSW captures the resulting request so we
 * can assert the URL and headers the hook actually produced.
 */

const BASE_URL = 'http://localhost:4000';

type ProviderProps = {
  baseUrl?: string;
  apiPrefix?: string;
  headers?: Record<string, string>;
};

type CapturedRequest = {
  url: string;
  headers: Headers;
  count: number;
  body?: unknown;
};

const captureSignIn = (responseBody: unknown, ok = true): CapturedRequest => {
  const captured: CapturedRequest = { url: '', headers: new Headers(), count: 0 };
  server.use(
    http.post('*/auth/credentials/sign-in', async ({ request }) => {
      captured.url = request.url;
      captured.headers = request.headers;
      captured.count += 1;
      captured.body = await request.clone().json();
      return HttpResponse.json(responseBody as Record<string, unknown>, { status: ok ? 200 : 400 });
    }),
  );
  return captured;
};

const captureSignUp = (responseBody: unknown, ok = true): CapturedRequest => {
  const captured: CapturedRequest = { url: '', headers: new Headers(), count: 0 };
  server.use(
    http.post('*/auth/credentials/sign-up', async ({ request }) => {
      captured.url = request.url;
      captured.headers = request.headers;
      captured.count += 1;
      captured.body = await request.clone().json();
      return HttpResponse.json(responseBody as Record<string, unknown>, { status: ok ? 200 : 400 });
    }),
  );
  return captured;
};

const makeHarness = ({ baseUrl = BASE_URL, apiPrefix, headers }: ProviderProps) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MastraReactProvider baseUrl={baseUrl} apiPrefix={apiPrefix} headers={headers}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

const makeWrapper = (props: ProviderProps) => makeHarness(props).wrapper;

const signIn = async (providerProps: ProviderProps) => {
  const { result } = renderHook(() => useCredentialsLogin(), { wrapper: makeWrapper(providerProps) });
  await act(async () => {
    result.current.mutate({ email: 'a@b.c', password: 'pw' });
  });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return result;
};

const signUp = async (providerProps: ProviderProps) => {
  const { result } = renderHook(() => useCredentialsSignUp(), { wrapper: makeWrapper(providerProps) });
  await act(async () => {
    result.current.mutate({ email: 'a@b.c', password: 'pw', name: 'A' });
  });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return result;
};

describe('useCredentialsLogin', () => {
  describe('when the client has a custom apiPrefix', () => {
    it('targets the sign-in endpoint under that prefix', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: '/mastra' });

      expect(captured.count).toBe(1);
      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });
  });

  describe('when the client has no apiPrefix', () => {
    it('defaults the sign-in endpoint to /api', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({});

      expect(captured.url).toBe('http://localhost:4000/api/auth/credentials/sign-in');
    });
  });

  describe('when the apiPrefix has a trailing slash', () => {
    it('strips the trailing slash from the sign-in endpoint', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: '/mastra/' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });
  });

  describe('when the apiPrefix has no leading slash', () => {
    it('adds a leading slash to the sign-in endpoint', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: 'mastra' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });
  });

  describe('when the apiPrefix is explicitly empty', () => {
    it('omits any prefix from the sign-in endpoint', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: '' });

      expect(captured.url).toBe('http://localhost:4000/auth/credentials/sign-in');
    });
  });

  describe('when the client carries custom headers', () => {
    it('forwards them on the sign-in request', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ headers: { 'x-tenant-id': 'tenant-123', Authorization: 'Bearer dev-token' } });

      expect(captured.headers.get('x-tenant-id')).toBe('tenant-123');
      expect(captured.headers.get('Authorization')).toBe('Bearer dev-token');
    });

    it('does not let client headers override Content-Type on sign-in', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ headers: { 'Content-Type': 'text/plain' } });

      expect(captured.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('when the server rejects the sign-in', () => {
    it('surfaces the server error message', async () => {
      captureSignIn({ message: 'Invalid email or password' }, false);

      const result = await signIn({});

      expect(result.current.error?.message).toBe('Invalid email or password');
    });
  });
  describe('the request it sends', () => {
    it('posts the credentials the caller supplied', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({});

      expect(captured.body).toEqual({ email: 'a@b.c', password: 'pw' });
    });

    it('strips whitespace around a hand-typed apiPrefix', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: '  /mastra  ' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });

    it('strips repeated trailing slashes from the apiPrefix', async () => {
      const captured = captureSignIn({ user: { id: '1', email: 'a@b.c' } });

      await signIn({ apiPrefix: '/mastra//' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-in');
    });
  });

  describe('when the server rejects the sign-in without a message', () => {
    it('falls back to the error field', async () => {
      captureSignIn({ error: 'account locked' }, false);

      const result = await signIn({});

      expect(result.current.error?.message).toBe('account locked');
    });

    it('falls back to a generic message when the body says nothing', async () => {
      captureSignIn({}, false);

      const result = await signIn({});

      expect(result.current.error?.message).toBe('Invalid email or password');
    });
  });

  describe('when the sign-in succeeds', () => {
    it('invalidates the auth caches so the user state refetches', async () => {
      captureSignIn({ user: { id: '1', email: 'a@b.c' } });
      const { wrapper, queryClient } = makeHarness({});
      queryClient.setQueryData(['auth', 'capabilities'], { enabled: true });
      queryClient.setQueryData(['stored-agents'], { agents: [] });

      const { result } = renderHook(() => useCredentialsLogin(), { wrapper });
      await act(async () => {
        result.current.mutate({ email: 'a@b.c', password: 'pw' });
      });

      await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(false);
    });

    it('leaves the auth caches alone when the sign-in fails', async () => {
      captureSignIn({ message: 'nope' }, false);
      const { wrapper, queryClient } = makeHarness({});
      queryClient.setQueryData(['auth', 'capabilities'], { enabled: true });

      const { result } = renderHook(() => useCredentialsLogin(), { wrapper });
      await act(async () => {
        result.current.mutate({ email: 'a@b.c', password: 'pw' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(false);
    });
  });
});

describe('useCredentialsSignUp', () => {
  describe('when the client has a custom apiPrefix', () => {
    it('targets the sign-up endpoint under that prefix', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ apiPrefix: '/mastra' });

      expect(captured.count).toBe(1);
      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });
  });

  describe('when the client has no apiPrefix', () => {
    it('defaults the sign-up endpoint to /api', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({});

      expect(captured.url).toBe('http://localhost:4000/api/auth/credentials/sign-up');
    });
  });

  describe('when the apiPrefix has a trailing slash', () => {
    it('strips the trailing slash from the sign-up endpoint', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ apiPrefix: '/mastra/' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });
  });

  describe('when the apiPrefix is explicitly empty', () => {
    it('omits any prefix from the sign-up endpoint', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ apiPrefix: '' });

      expect(captured.url).toBe('http://localhost:4000/auth/credentials/sign-up');
    });
  });

  describe('when the client carries custom headers', () => {
    it('forwards them on the sign-up request', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ headers: { 'x-tenant-id': 'tenant-123', Authorization: 'Bearer dev-token' } });

      expect(captured.headers.get('x-tenant-id')).toBe('tenant-123');
      expect(captured.headers.get('Authorization')).toBe('Bearer dev-token');
    });

    it('does not let client headers override Content-Type on sign-up', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ headers: { 'Content-Type': 'text/plain' } });

      expect(captured.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('when the server rejects the sign-up', () => {
    it('surfaces the server error message', async () => {
      captureSignUp({ message: 'Email already in use' }, false);

      const result = await signUp({});

      expect(result.current.error?.message).toBe('Email already in use');
    });
  });
  describe('the request it sends', () => {
    it('posts the credentials and display name the caller supplied', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({});

      expect(captured.body).toEqual({ email: 'a@b.c', password: 'pw', name: 'A' });
    });

    it('strips whitespace around a hand-typed apiPrefix', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ apiPrefix: '  /mastra  ' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });

    it('strips repeated trailing slashes from the apiPrefix', async () => {
      const captured = captureSignUp({ user: { id: '1', email: 'a@b.c' } });

      await signUp({ apiPrefix: '/mastra//' });

      expect(captured.url).toBe('http://localhost:4000/mastra/auth/credentials/sign-up');
    });
  });

  describe('when the server rejects the sign-up', () => {
    it('surfaces the server message', async () => {
      captureSignUp({ message: 'email already registered' }, false);

      const result = await signUp({});

      expect(result.current.error?.message).toBe('email already registered');
    });

    it('falls back to the error field', async () => {
      captureSignUp({ error: 'weak password' }, false);

      const result = await signUp({});

      expect(result.current.error?.message).toBe('weak password');
    });

    it('falls back to a generic message when the body says nothing', async () => {
      captureSignUp({}, false);

      const result = await signUp({});

      expect(result.current.error?.message).toBe('Failed to create account');
    });
  });

  describe('when the sign-up succeeds', () => {
    it('invalidates the auth caches so the user state refetches', async () => {
      captureSignUp({ user: { id: '1', email: 'a@b.c' } });
      const { wrapper, queryClient } = makeHarness({});
      queryClient.setQueryData(['auth', 'capabilities'], { enabled: true });
      queryClient.setQueryData(['stored-agents'], { agents: [] });

      const { result } = renderHook(() => useCredentialsSignUp(), { wrapper });
      await act(async () => {
        result.current.mutate({ email: 'a@b.c', password: 'pw', name: 'A' });
      });

      await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(false);
    });
  });
});
