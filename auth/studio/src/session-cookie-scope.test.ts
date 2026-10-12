import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MastraAuthStudio } from './index';

// SP-5: session cookies must be host-only by default. They previously inherited
// a shared parent `Domain` (from `MASTRA_COOKIE_DOMAIN` or an auto-detected
// `.mastra.ai`), which presented the account-scoped sealed session to every
// sibling tenant host on that parent domain.

let originalCwd: string;
let scratchCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  scratchCwd = mkdtempSync(join(tmpdir(), 'mastra-auth-studio-cookie-'));
  process.chdir(scratchCwd);
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(scratchCwd, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.MASTRA_COOKIE_DOMAIN;
});

const session = { id: 'sess-1', userId: 'u1', expiresAt: new Date(), createdAt: new Date() } as any;
const setCookie = (a: MastraAuthStudio) => a.getSessionHeaders(session)['Set-Cookie'];

describe('session cookie scope (SP-5)', () => {
  it('is host-only by default', () => {
    const a = new MastraAuthStudio({ sharedApiUrl: 'https://api.mastra.ai/v1' });
    expect(setCookie(a)).not.toContain('Domain=');
  });

  it('ignores MASTRA_COOKIE_DOMAIN for setting', () => {
    process.env.MASTRA_COOKIE_DOMAIN = '.mastra.cloud';
    const a = new MastraAuthStudio({ sharedApiUrl: 'https://api.mastra.ai/v1' });
    expect(setCookie(a)).not.toContain('Domain=');
  });

  it('still stamps an explicitly configured cookieDomain', () => {
    process.env.MASTRA_COOKIE_DOMAIN = '.mastra.cloud';
    const a = new MastraAuthStudio({ sharedApiUrl: 'https://api.mastra.ai/v1', cookieDomain: '.example.com' });
    expect(setCookie(a)).toContain('Domain=.example.com');
  });

  it('exposes a legacy clear-cookie when MASTRA_COOKIE_DOMAIN named a parent', () => {
    process.env.MASTRA_COOKIE_DOMAIN = '.mastra.cloud';
    const a = new MastraAuthStudio({ sharedApiUrl: 'https://api.mastra.ai/v1' });
    const clear = a.getLegacySessionClearCookie();
    expect(clear).toContain('wos-session=');
    expect(clear).toContain('Max-Age=0');
    expect(clear).toContain('Domain=.mastra.cloud');
  });

  it('exposes a legacy clear-cookie for the old .mastra.ai auto-detect', () => {
    const a = new MastraAuthStudio({ sharedApiUrl: 'https://api.mastra.ai/v1' });
    expect(a.getLegacySessionClearCookie()).toContain('Domain=.mastra.ai');
  });

  it('has no legacy clear-cookie when no parent domain was ever named', () => {
    const a = new MastraAuthStudio({ sharedApiUrl: 'http://localhost:3010/v1' });
    expect(a.getLegacySessionClearCookie()).toBeUndefined();
  });
});
