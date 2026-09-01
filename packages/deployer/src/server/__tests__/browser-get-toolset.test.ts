import { tmpdir } from 'node:os';
import { Agent } from '@mastra/core/agent';
import type { MastraBrowser } from '@mastra/core/browser';
import { Mastra } from '@mastra/core/mastra';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import type * as MastraHono from '@mastra/hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

type GetToolset = (agentId: string) => MastraBrowser | undefined | Promise<MastraBrowser | undefined>;

function createMockBrowser(providerType: 'sdk' | 'cli'): MastraBrowser {
  return {
    id: `mock-${providerType}-browser`,
    providerType,
    provider: 'mock',
    headless: true,
    getTools: () => ({}),
    getInputProcessors: vi.fn().mockReturnValue([]),
    isBrowserRunning: vi.fn().mockReturnValue(false),
    hasThreadSession: vi.fn().mockReturnValue(false),
    onBrowserReady: vi.fn().mockReturnValue(() => {}),
    onBrowserClosed: vi.fn().mockReturnValue(() => {}),
    startScreencastIfBrowserActive: vi.fn().mockResolvedValue(null),
    getCurrentUrl: vi.fn().mockResolvedValue('about:blank'),
  } as unknown as MastraBrowser;
}

/**
 * Boots the deployer server with a mocked `setupBrowserStream` and returns the
 * `getToolset` callback the deployer passed to it.
 */
async function captureGetToolset(mastra: Mastra): Promise<GetToolset> {
  let captured: GetToolset | undefined;
  vi.doMock('@mastra/hono', async () => {
    const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
    return {
      ...actual,
      setupBrowserStream: vi.fn().mockImplementation(async (_app: unknown, config: { getToolset: GetToolset }) => {
        captured = config.getToolset;
        return { injectWebSocket: () => {}, registry: {} };
      }),
    };
  });

  const { createHonoServer } = await import('../index');
  await createHonoServer(mastra, { tools: {} });
  if (!captured) throw new Error('setupBrowserStream was not called');
  return captured;
}

function createWorkspace(browser: MastraBrowser) {
  return new Workspace({ id: 'ws', name: 'ws', filesystem: new LocalFilesystem({ basePath: tmpdir() }), browser });
}

function createAgent(options: { browser?: MastraBrowser; workspace?: Workspace } = {}) {
  return new Agent({
    id: 'browser-agent',
    name: 'browser-agent',
    instructions: 'test',
    model: 'openai/gpt-4o',
    ...options,
  });
}

describe('deployer browser stream getToolset', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@mastra/hono');
  });

  it('returns the agent-level SDK browser', async () => {
    const browser = createMockBrowser('sdk');
    const mastra = new Mastra({ logger: false, agents: { agent: createAgent({ browser }) } });

    const getToolset = await captureGetToolset(mastra);

    await expect(getToolset('browser-agent')).resolves.toBe(browser);
  });

  it('resolves a CLI browser from the agent-level workspace before any request has run', async () => {
    const browser = createMockBrowser('cli');
    const workspace = createWorkspace(browser);
    const agent = createAgent({ workspace });
    const mastra = new Mastra({ logger: false, agents: { agent } });

    const getToolset = await captureGetToolset(mastra);

    await expect(getToolset('browser-agent')).resolves.toBe(browser);
  });

  it('resolves a CLI browser from the Mastra-global workspace before any request has run', async () => {
    const browser = createMockBrowser('cli');
    const workspace = createWorkspace(browser);
    const agent = createAgent();
    const mastra = new Mastra({ logger: false, agents: { agent }, workspace });

    const getToolset = await captureGetToolset(mastra);

    // Sanity: the CLI browser is not on the agent until a request resolves the workspace,
    // so this is exactly the case a pre-request viewer connect hits.
    expect(agent.browser).toBeUndefined();
    await expect(getToolset('browser-agent')).resolves.toBe(browser);
  });

  it('returns undefined when the agent has neither an agent nor a workspace browser', async () => {
    const mastra = new Mastra({ logger: false, agents: { agent: createAgent() } });

    const getToolset = await captureGetToolset(mastra);

    await expect(getToolset('browser-agent')).resolves.toBeUndefined();
  });

  it('returns undefined for an unknown agent id', async () => {
    const mastra = new Mastra({ logger: false });

    const getToolset = await captureGetToolset(mastra);

    await expect(getToolset('missing-agent')).resolves.toBeUndefined();
  });
});
