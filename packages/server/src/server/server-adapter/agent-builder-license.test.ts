import type { IMastraAgentBuilder } from '@mastra/core/agent-builder/ee';
import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MastraServer } from './index';

class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

function fakeAgentBuilder(): IMastraAgentBuilder {
  return {
    enabledSections: ['tools'],
    marketplace: { enabled: false, showAgents: false, showSkills: false },
    configure: { allowSkillCreation: false, allowAppearance: false },
    recents: { maxItems: 5 },
    getEnabledSections: () => ['tools'],
    getMarketplaceConfig: () => ({ enabled: false, showAgents: false, showSkills: false }),
    getConfigureConfig: () => ({ allowSkillCreation: false, allowAppearance: false }),
    getRecentsConfig: () => ({ maxItems: 5 }),
  };
}

describe('validateAgentBuilderLicense', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MASTRA_EE_LICENSE;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is a no-op when no agentBuilder is configured', async () => {
    const mastra = new Mastra({});
    const adapter = new TestMastraServer({ app: {}, mastra });
    await expect(adapter.validateAgentBuilderLicense()).resolves.toBeUndefined();
  });

  it('allows boot in dev without a license when agentBuilder is configured', async () => {
    process.env.NODE_ENV = 'development';
    const mastra = new Mastra({ agentBuilder: fakeAgentBuilder() });
    const adapter = new TestMastraServer({ app: {}, mastra });
    await expect(adapter.validateAgentBuilderLicense()).resolves.toBeUndefined();
  });

  it('throws in production without a valid license when agentBuilder is configured', async () => {
    process.env.NODE_ENV = 'production';
    const mastra = new Mastra({ agentBuilder: fakeAgentBuilder() });
    const adapter = new TestMastraServer({ app: {}, mastra });
    await expect(adapter.validateAgentBuilderLicense()).rejects.toThrow(/\[mastra\/auth-ee\]/);
  });
});
