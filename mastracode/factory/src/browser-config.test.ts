import { AgentBrowser } from '@mastra/agent-browser';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from './factory.js';

const prepareMock = vi.fn(async (_config: Record<string, unknown>) => ({
  base: { controller: { onSessionCreated: vi.fn(), setChannels: vi.fn() } },
  mastraArgs: {},
  finalize: vi.fn(async () => {}),
}));

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

const storage = () => new LibSQLFactoryStorage({ url: ':memory:', id: 'browser-config-test' });

describe('MastraFactory browser config', () => {
  beforeEach(() => prepareMock.mockClear());

  it('hands a thread-scoped browser to the session controller', async () => {
    const browser = new AgentBrowser({ headless: true, scope: 'thread' });
    await new MastraFactory({ storage: storage(), browser }).prepare();
    expect(prepareMock.mock.calls[0]![0].browser).toBe(browser);
  });

  it('mounts no browser by default', async () => {
    await new MastraFactory({ storage: storage() }).prepare();
    expect(prepareMock.mock.calls[0]![0]).not.toHaveProperty('browser');
  });

  it('rejects a shared browser, which would mix pages and cookies across Factory users', () => {
    const browser = new AgentBrowser({ headless: true, scope: 'shared' });
    expect(() => new MastraFactory({ storage: storage(), browser })).toThrow(/scope: 'thread'/);
  });
});
