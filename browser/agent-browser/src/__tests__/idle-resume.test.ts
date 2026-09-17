import { createServer } from 'node:http';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { AgentBrowser } from '../agent-browser';

describe('real browser saved-tab restoration', () => {
  it('closes and restores pages and selected tab through a new native browser object', async () => {
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(`<title>Saved ${req.url}</title><button>Activity</button>`);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const storage = new InMemoryStore();
    const memory = (await storage.getStore('memory'))!;
    await memory.saveThread({
      thread: {
        id: 'chat',
        resourceId: 'owner',
        title: 'Browser test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const config = {
      scope: 'shared' as const,
      headless: true,
      executablePath: process.env.BROWSER_TEST_EXECUTABLE,
      observeUserActivity: true,
      idleTimeoutMs: 120000,
      savedTabs: { storage, threadId: 'chat', resourceId: 'owner' },
    };
    const first = new AgentBrowser(config);
    const resumed = new AgentBrowser(config);
    try {
      first.setCurrentThread('chat');
      await first.ensureReady();
      await first.goto({ url: origin + '/first' });
      await first.tabs({ action: 'new', url: origin + '/second' });
      await first.tabs({ action: 'switch', index: 0 });
      const before = await first.getBrowserState();
      expect(before?.tabs.map(tab => tab.url)).toEqual([origin + '/first', origin + '/second']);
      await first.close();
      resumed.setCurrentThread('chat');
      await resumed.ensureReady();
      const after = await resumed.getBrowserState();
      expect(after?.tabs.map(tab => tab.url)).toEqual(before?.tabs.map(tab => tab.url));
      expect(after?.activeTabIndex).toBe(0);
      expect(resumed.getActivityState().incarnation).not.toBe(first.getActivityState().incarnation);
      expect(resumed.getActivityState().idleDeadlineAt).toBeGreaterThan(Date.now());
    } finally {
      await first.close();
      await resumed.close();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
  }, 30000);
});
