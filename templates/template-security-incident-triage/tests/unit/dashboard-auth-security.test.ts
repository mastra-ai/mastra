import { describe, expect, it } from 'vitest';

import {
  createCsrfToken,
  hasCrossSiteMutationEvidence,
  isSameOriginMutation,
  verifyCsrfToken,
} from '../../src/app/auth/csrf.js';
import { resolveDashboardPrincipal } from '../../src/app/auth/dashboard-principal.js';
import { openPkceState, safeDashboardNext, sealPkceState } from '../../src/app/auth/pkce-state.js';
import { openSessionIssuedAt, sealSessionIssuedAt } from '../../src/app/auth/session-lifetime.js';
import { safeWorkosRedirect } from '../../src/app/auth/workos-session.js';

describe('dashboard dashboard auth boundaries', () => {
  it('fails closed for absent, unknown, or multiple membership roles', () => {
    const base = {
      userId: 'user_123',
      sessionId: 'session_123',
      organizationId: 'tenant_123',
    };
    expect(resolveDashboardPrincipal({ ...base, roles: [] })).toBeNull();
    expect(resolveDashboardPrincipal({ ...base, roles: ['soc_manager', 'viewer'] })).toBeNull();
    expect(resolveDashboardPrincipal({ ...base, roles: ['soc_manager', 'owner'] })).toBeNull();
    expect(resolveDashboardPrincipal({ ...base, roles: ['soc_manager'] })).toMatchObject({
      tenantId: 'tenant_123',
      role: 'soc_manager',
    });
    expect(resolveDashboardPrincipal({ ...base, roles: ['soc-manager'] })).toMatchObject({
      tenantId: 'tenant_123',
      role: 'soc_manager',
    });
    expect(resolveDashboardPrincipal({ ...base, roles: ['member'] })).toBeNull();
  });

  it('binds CSRF to the authenticated session and tenant', () => {
    const secret = 'a'.repeat(32);
    const token = createCsrfToken(secret, {
      sessionId: 'session_123',
      tenantId: 'tenant_123',
    });
    expect(
      verifyCsrfToken(secret, {
        sessionId: 'session_123',
        tenantId: 'tenant_123',
        token,
      }),
    ).toBe(true);
    expect(
      verifyCsrfToken(secret, {
        sessionId: 'session_other',
        tenantId: 'tenant_123',
        token,
      }),
    ).toBe(false);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://dashboard.test',
            'Sec-Fetch-Site': 'same-origin',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: { 'Sec-Fetch-Site': 'same-origin' },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(isSameOriginMutation(new Request('https://dashboard.test/api'), 'https://dashboard.test')).toBe(false);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: { Origin: 'https://dashboard.test' },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://evil.test',
            'Sec-Fetch-Site': 'cross-site',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(false);
    expect(hasCrossSiteMutationEvidence(new Request('https://dashboard.test/api'), 'https://dashboard.test')).toBe(
      false,
    );
    expect(
      hasCrossSiteMutationEvidence(
        new Request('https://dashboard.test/api', {
          headers: { Origin: 'https://evil.test' },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://dashboard.test',
            'Sec-Fetch-Site': 'none',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(
      hasCrossSiteMutationEvidence(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://dashboard.test',
            'Sec-Fetch-Site': 'none',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(false);
    expect(
      isSameOriginMutation(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://proxy-origin.test',
            'Sec-Fetch-Site': 'same-origin',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(true);
    expect(
      hasCrossSiteMutationEvidence(
        new Request('https://dashboard.test/api', {
          headers: {
            Origin: 'https://proxy-origin.test',
            'Sec-Fetch-Site': 'same-origin',
          },
        }),
        'https://dashboard.test',
      ),
    ).toBe(false);
  });

  it('signs, expires, and constrains PKCE state destinations', () => {
    const secret = 'b'.repeat(32);
    const now = 1_700_000_000_000;
    const token = sealPkceState(secret, {
      state: 's'.repeat(16),
      verifier: 'v'.repeat(43),
      next: '/dashboard',
      issuedAtMs: now,
    });
    expect(openPkceState(secret, token, now + 1)).toMatchObject({
      next: '/dashboard',
    });
    expect(openPkceState(secret, `${token}x`, now + 1)).toBeNull();
    expect(openPkceState(secret, token, now + 600_001)).toBeNull();
    expect(safeDashboardNext('https://evil.test')).toBe('/dashboard');
  });

  it('enforces an HMAC-bound absolute session lifetime and WorkOS redirects', () => {
    const secret = 'd'.repeat(32);
    const issuedAt = 1_700_000_000_000;
    const token = sealSessionIssuedAt(secret, issuedAt);
    expect(openSessionIssuedAt(secret, token, issuedAt + 28_799_000, 28_800)).toBe(issuedAt);
    expect(openSessionIssuedAt(secret, token, issuedAt + 28_800_000, 28_800)).toBeNull();
    expect(openSessionIssuedAt(secret, `${token}x`, issuedAt, 28_800)).toBeNull();
    expect(safeWorkosRedirect('https://api.workos.com/user_management/authorize?x=1')).toContain('api.workos.com');
    expect(safeWorkosRedirect('https://evil.test/user_management/authorize')).toBeNull();
  });
});
