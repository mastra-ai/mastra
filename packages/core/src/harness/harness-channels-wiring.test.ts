import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { HarnessChannels } from '../channels/harness-channels';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createMockAdapter(name: string) {
  return { name } as any;
}

describe('Harness channels wiring', () => {
  it('builds a HarnessChannels from inline config and binds itself', () => {
    const harness = new Harness({
      id: 'support',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      channels: {
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
      },
    });

    const channels = harness.getChannels();
    expect(channels).toBeInstanceOf(HarnessChannels);
    // Bound: webhook routes are harness-scoped, proving __setHarness ran.
    const routes = channels!.getWebhookRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/api/harnesses/support/channels/slack/webhook');
  });

  it('accepts a pre-built HarnessChannels instance and binds it', () => {
    const prebuilt = new HarnessChannels({
      state: {} as any,
      adapters: { slack: createMockAdapter('slack') },
    });

    const harness = new Harness({
      id: 'sales',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      channels: prebuilt,
    });

    expect(harness.getChannels()).toBe(prebuilt);
    expect(prebuilt.getWebhookRoutes()[0]?.path).toBe('/api/harnesses/sales/channels/slack/webhook');
  });

  it('leaves getChannels undefined when no channels are configured', () => {
    const harness = new Harness({
      id: 'plain',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    expect(harness.getChannels()).toBeUndefined();
  });

  it('registers harness channel webhook routes on the Mastra server', () => {
    const harness = new Harness({
      id: 'support',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      channels: {
        state: {} as any,
        adapters: { slack: createMockAdapter('slack') },
      },
    });

    const mastra = new Mastra({ harnesses: { support: harness } });
    const routes = mastra.getServer()?.apiRoutes ?? [];
    const harnessRoute = routes.find(r => r.path === '/api/harnesses/support/channels/slack/webhook');
    expect(harnessRoute).toBeDefined();
    expect(harnessRoute?.method).toBe('POST');
  });
});
