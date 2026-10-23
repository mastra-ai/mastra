import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOST_SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME, MastraAuthStudio } from './index';

// SP-5: the Studio session cookie must never be scoped to a domain shared with
// other tenants' deployments, and legacy shared-domain copies must be expired.

const PROD_API = 'https://platform.mastra.ai/v1';
const session = { id: 'sealed', userId: 'u', expiresAt: new Date(), createdAt: new Date() };
const ENV_KEYS = ['MASTRA_COOKIE_DOMAIN', 'MASTRA_LEGACY_COOKIE_DOMAINS', 'MASTRA_SHARED_API_URL'] as const;

const meResponse = () =>
  new Response(JSON.stringify({ user: { id: 'user-1', email: 'a@example.com' }, organizationId: 'org-1' }), {
    status: 200,
  });

describe('MastraAuthStudio session cookie scope', () => {
  const saved: Record<string, string | undefined> = {};
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  describe('platform deployment (MASTRA_COOKIE_DOMAIN = own host, legacy parent listed)', () => {
    beforeEach(() => {
      process.env.MASTRA_COOKIE_DOMAIN = 'my-app.studio.mastra.cloud';
      process.env.MASTRA_LEGACY_COOKIE_DOMAINS = '.mastra.cloud';
    });

    it('issues __Host-wos-session: Secure, Path=/, no Domain', () => {
      const cookie = new MastraAuthStudio({ sharedApiUrl: PROD_API }).getSessionHeaders(session)['Set-Cookie']!;
      expect(cookie.startsWith(`${HOST_SESSION_COOKIE_NAME}=sealed;`)).toBe(true);
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toMatch(/Domain=/i);
    });

    it('expires legacy wos-session on the host, the injected domain and every legacy domain', () => {
      const clears = new MastraAuthStudio({ sharedApiUrl: PROD_API }).getLegacySessionClearCookies();
      expect(clears).toEqual([
        'wos-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure',
        'wos-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure; Domain=my-app.studio.mastra.cloud',
        'wos-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure; Domain=.mastra.ai',
        'wos-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure; Domain=.mastra.cloud',
      ]);
    });

    it('ignores malformed legacy domains', () => {
      process.env.MASTRA_LEGACY_COOKIE_DOMAINS = '.mastra.cloud, ;evil=1, , bad domain';
      const clears = new MastraAuthStudio({ sharedApiUrl: PROD_API }).getLegacySessionClearCookies();
      expect(clears.filter(c => c.includes('Domain=.mastra.cloud'))).toHaveLength(1);
      expect(clears.join('\n')).not.toContain('evil');
      expect(clears.join('\n')).not.toContain('bad domain');
    });

    it('prefers __Host-wos-session over a legacy wos-session on read', () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: PROD_API });
      const req = new Request('https://my-app.studio.mastra.cloud/', {
        headers: { cookie: 'wos-session=attacker-tossed; __Host-wos-session=mine' },
      });
      expect(auth.getSessionIdFromRequest(req)).toBe('mine');
    });

    it('accepts a legacy wos-session only to migrate it to __Host-wos-session', async () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: PROD_API });
      fetchSpy.mockResolvedValueOnce(meResponse());
      const req = new Request('https://my-app.studio.mastra.cloud/', { headers: { cookie: 'wos-session=old' } });

      const user = await auth.getCurrentUser(req);

      expect(user?.id).toBe('user-1');
      // Upstream calls to the shared API keep using its own cookie name.
      expect(fetchSpy.mock.calls[0]![1].headers.Cookie).toBe('wos-session=old');
      const pending = auth.consumePendingResponseHeaders(req)?.['Set-Cookie'];
      expect(pending).toMatch(/^__Host-wos-session=old;/);
      expect(pending).not.toMatch(/Domain=/i);
    });

    it('does not migrate an unverified legacy cookie', async () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: PROD_API });
      fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 401 }));
      const req = new Request('https://my-app.studio.mastra.cloud/', { headers: { cookie: 'wos-session=bad' } });

      expect(await auth.getCurrentUser(req)).toBeNull();
      expect(auth.consumePendingResponseHeaders(req)).toBeUndefined();
    });

    it('matches cookie names exactly', () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: PROD_API });
      const req = new Request('https://x/', { headers: { cookie: 'x__Host-wos-session=a; my-wos-session=b' } });
      expect(auth.getSessionIdFromRequest(req)).toBeNull();
    });
  });

  describe('localhost dev', () => {
    it('keeps an unprefixed host-only cookie without Secure on plain http', () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: 'http://localhost:3010/v1' });
      expect(auth.getSessionHeaders(session)['Set-Cookie']).toBe(
        `${LEGACY_SESSION_COOKIE_NAME}=sealed; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`,
      );
      // The live cookie is the host-only wos-session, so it is not "legacy".
      expect(auth.getLegacySessionClearCookies()).toEqual([]);
    });

    it('treats a localhost MASTRA_COOKIE_DOMAIN as insecure dev', () => {
      process.env.MASTRA_COOKIE_DOMAIN = 'my-app.studio.localhost';
      const cookie = new MastraAuthStudio({ sharedApiUrl: 'http://localhost:3010/v1' }).getSessionHeaders(session)[
        'Set-Cookie'
      ]!;
      expect(cookie.startsWith('wos-session=sealed;')).toBe(true);
      expect(cookie).not.toContain('Secure');
      expect(cookie).not.toMatch(/Domain=/i);
    });

    it('can be forced secure', () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: 'http://localhost:3010/v1', secureCookies: true });
      expect(auth.getSessionHeaders(session)['Set-Cookie']).toMatch(/^__Host-wos-session=sealed;.*Secure$/);
    });
  });

  describe('explicit cookieDomain option', () => {
    it('issues an unprefixed domain cookie (a __Host- cookie cannot carry Domain)', () => {
      const auth = new MastraAuthStudio({ sharedApiUrl: PROD_API, cookieDomain: '.example.com' });
      const cookie = auth.getSessionHeaders(session)['Set-Cookie']!;
      expect(cookie.startsWith('wos-session=sealed;')).toBe(true);
      expect(cookie).toContain('Domain=.example.com');
      expect(auth.getLegacySessionClearCookies().some(c => c.includes('Domain=.example.com'))).toBe(false);
    });
  });
});
