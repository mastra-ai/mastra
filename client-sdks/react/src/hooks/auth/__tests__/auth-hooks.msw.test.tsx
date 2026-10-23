// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../test/render';
import type { SSOLoginResponse } from '../sso-login';
import type { AuthCapabilities, LogoutResponse } from '../types';
import { useLogout, useSSOLogin } from '../use-auth-actions';
import { usePermissionPatterns } from '../use-permission-patterns';

type PermissionPatternsResponse = Awaited<ReturnType<MastraClient['getPermissionPatterns']>>;

const logoutResponse: LogoutResponse = { success: true, redirectTo: 'https://identity.example.com/logout' };

const rbacCapabilities: AuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['*'] },
};

const permissionPatterns: PermissionPatternsResponse = { patterns: ['agents:read', 'agents:*'] };

describe('useLogout', () => {
  describe('when the server ends the session', () => {
    it('runs the onLoggedOut cleanup with the signed-out user and resolves the logout response', async () => {
      server.use(http.post(`${TEST_BASE_URL}/api/auth/logout`, () => HttpResponse.json(logoutResponse)));
      const onLoggedOut = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHookWithProviders(() => useLogout({ onLoggedOut }));

      let response: LogoutResponse | undefined;
      await act(async () => {
        response = await result.current.mutateAsync({ userId: 'user-1' });
      });

      expect({ response, calls: onLoggedOut.mock.calls }).toEqual({
        response: logoutResponse,
        calls: [[{ userId: 'user-1' }]],
      });
    });
  });

  describe('when the onLoggedOut cleanup fails', () => {
    it('still resolves the logout', async () => {
      server.use(http.post(`${TEST_BASE_URL}/api/auth/logout`, () => HttpResponse.json(logoutResponse)));
      const { result } = renderHookWithProviders(() =>
        useLogout({ onLoggedOut: () => Promise.reject(new Error('storage blocked')) }),
      );

      await act(async () => {
        await expect(result.current.mutateAsync({ userId: 'user-1' })).resolves.toEqual(logoutResponse);
      });
    });
  });

  describe('when the server fails to end the session', () => {
    it('rejects without running the onLoggedOut cleanup', async () => {
      server.use(http.post(`${TEST_BASE_URL}/api/auth/logout`, () => new HttpResponse(null, { status: 500 })));
      const onLoggedOut = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHookWithProviders(() => useLogout({ onLoggedOut }));

      await act(async () => {
        await expect(result.current.mutateAsync({ userId: 'user-1' })).rejects.toThrow('Failed to logout: 500');
      });
      expect(onLoggedOut).not.toHaveBeenCalled();
    });
  });
});

describe('useSSOLogin', () => {
  describe('when the server returns an SSO login URL', () => {
    it('resolves the URL for the given redirect', async () => {
      const ssoResponse: SSOLoginResponse = { url: 'https://identity.example.com/authorize' };
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/sso/login`, ({ request }) =>
          new URL(request.url).searchParams.get('redirect_uri') === 'http://localhost/back'
            ? HttpResponse.json(ssoResponse)
            : new HttpResponse(null, { status: 400 }),
        ),
      );
      const { result } = renderHookWithProviders(() => useSSOLogin());

      await act(async () => {
        await expect(result.current.mutateAsync({ redirectUri: 'http://localhost/back' })).resolves.toEqual(
          ssoResponse,
        );
      });
    });
  });
});

describe('usePermissionPatterns', () => {
  describe('when RBAC is enabled for the signed-in user', () => {
    it('returns the server permission patterns as a set', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(rbacCapabilities)),
        http.get(`${TEST_BASE_URL}/api/auth/permission-patterns`, () => HttpResponse.json(permissionPatterns)),
      );
      const { result } = renderHookWithProviders(() => usePermissionPatterns());

      await waitFor(() => expect([...result.current.patterns]).toEqual(permissionPatterns.patterns));
    });
  });
});
