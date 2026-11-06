import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/stagehand', () => ({
  StagehandBrowser: class {
    constructor(private readonly config: { cdpUrl: string | (() => Promise<string>); scope: string }) {}
    async ensureReady() {
      return typeof this.config.cdpUrl === 'string' ? this.config.cdpUrl : this.config.cdpUrl();
    }
  },
}));

import { PlatformBrowser } from './index';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('PlatformBrowser provisioning', () => {
  it('connects to a supplied CDP URL without provisioning or Platform credentials', async () => {
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    const fetchImpl = vi.fn<typeof fetch>();
    const browser = new PlatformBrowser({ cdpUrl: 'wss://connect.browserbase.com/session-existing', fetch: fetchImpl });
    expect(await browser.ensureReady()).toBe('wss://connect.browserbase.com/session-existing');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('provisions a shared remote browser through Platform without sending Browserbase credentials to the client', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe('https://platform.mastra.ai/v1/browsers/sessions');
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer org-secret');
      expect(JSON.parse(String(init?.body))).toEqual({ projectId: 'project-1' });
      return Response.json({ connectUrl: 'wss://connect.browserbase.com/session-1' });
    });
    const browser = new PlatformBrowser({ accessToken: 'org-secret', projectId: 'project-1', fetch: fetchImpl });
    expect(await browser.ensureReady()).toBe('wss://connect.browserbase.com/session-1');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reports provisioning errors without exposing the access token', async () => {
    const browser = new PlatformBrowser({
      accessToken: 'org-secret',
      projectId: 'project-1',
      fetch: async () => new Response('Browserbase credentials leaked', { status: 502 }),
    });
    await expect(browser.ensureReady()).rejects.toThrow('PlatformBrowser: browser provisioning failed (502)');
  });

  it('uses environment credentials and refuses to create a session without a project', async () => {
    process.env.MASTRA_PLATFORM_SECRET_KEY = 'env-secret';
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PROJECT_ID;
    expect(() => new PlatformBrowser()).toThrow('PlatformBrowser: projectId is required');
  });
});
