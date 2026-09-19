import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { expect, it } from 'vitest';
import { MastraServer } from '../index';

it.skipIf(!process.env.MASTRA_TEST_BROWSER_EXECUTABLE)(
  'connects the authenticated SDK to the exact Session browser over native SSE and commands',
  async () => {
    const { AgentBrowser } = await import('../../../../browser/agent-browser/src/agent-browser');
    const { MastraClient } = await import('../../../../client-sdks/client-js/src/client');
    const browser = new AgentBrowser({
      scope: 'shared',
      headless: true,
      executablePath: process.env.MASTRA_TEST_BROWSER_EXECUTABLE,
      viewerPreferences: { width: 640, height: 480, deviceScaleFactor: 1, locale: 'en-US' },
      screencast: { format: 'png', maxWidth: 4096, maxHeight: 4096 },
    });
    const storage = new InMemoryStore();
    const controller = new AgentController({
      id: 'viewer-test',
      storage,
      workspace: new Workspace({ name: 'viewer-test', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'web',
          name: 'Web',
          default: true,
          agent: new Agent({ id: 'viewer-agent', name: 'Viewer agent', instructions: 'Test', model: {} as any }),
        },
      ],
      browser: async () => browser,
    });
    const mastra = new Mastra({
      logger: false,
      storage,
      agentControllers: { 'viewer-test': controller },
      server: {
        auth: {
          authenticateToken: async token => (token === 'local-viewer-test' ? { id: 'a' } : null),
          authorize: async () => true,
          mapUserToResourceId: user => `user:${(user as { id: string }).id}`,
        },
      },
    });
    await controller.init();
    const session = await controller.createSession({
      resourceId: 'user:a',
      id: 'thread-a',
      threadId: 'thread-a',
      ownerId: controller.id,
      scope: 'thread:thread-a',
    });
    expect(session.browser).toBe(browser);
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra, prefix: '/api' });
    await adapter.init();
    const client = new MastraClient({
      baseUrl: 'http://localhost',
      headers: { Authorization: 'Bearer local-viewer-test' },
      fetch: (url, init) => app.request(String(url), init),
    });
    let unsubscribe: (() => void) | undefined;
    try {
      const before = client
        .getAgentController('viewer-test')
        .session('user:a', 'thread:thread-a', { threadId: 'thread-a' })
        .browser('missing');
      await expect(before.subscribe({ onEvent() {}, onError() {} })).rejects.toThrow();
      expect(browser.isBrowserRunning()).toBe(false);
      await browser.launch();
      const page = (await browser.getManagerForThread()).getPage();
      await page.setContent('<input id="draft">');
      const incarnation = browser.getActivityState().incarnation;
      const viewer = client
        .getAgentController('viewer-test')
        .session('user:a', 'thread:thread-a', { threadId: 'thread-a' })
        .browser(incarnation);
      const events: any[] = [];
      const errors: Error[] = [];
      ({ unsubscribe } = await viewer.subscribe({
        onEvent: event => events.push(event),
        onError: error => errors.push(error),
      }));
      await expect.poll(() => events.some(event => event.type === 'frame')).toBe(true);
      await viewer.command({
        type: 'preferences',
        preferences: { width: 390, height: 844, deviceScaleFactor: 2, locale: 'ar-SA' },
      });
      expect(await page.evaluate(() => [innerWidth, innerHeight, navigator.language])).toEqual([390, 844, 'ar-SA']);
      await viewer.command({ type: 'new-tab' });
      await expect.poll(() => events.filter(event => event.type === 'state').at(-1)?.state?.tabs.length).toBe(2);
      const wrong = client
        .getAgentController('viewer-test')
        .session('user:b', 'thread:thread-a', { threadId: 'thread-a' })
        .browser(incarnation);
      await expect(wrong.command({ type: 'reload' })).rejects.toThrow();
      const anonymous = await app.request(
        '/api/agent-controller/viewer-test/sessions/user:a/browser/stream?sessionThreadId=thread-a&incarnation=' +
          incarnation,
      );
      expect(anonymous.status).toBe(401);
      expect(errors).toEqual([]);
      unsubscribe();
      unsubscribe = undefined;
      viewer.dispose();
      expect(browser.isBrowserRunning()).toBe(true);
    } finally {
      unsubscribe?.();
      await controller.deleteSession({ resourceId: 'user:a', scope: 'thread:thread-a' });
    }
  },
  30000,
);
