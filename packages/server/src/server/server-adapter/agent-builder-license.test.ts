import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraServer } from './index';

// Mock server adapter for testing
class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

// Mock editor that implements IMastraEditor.hasEnabledBuilderConfig()
// Avoids importing @mastra/editor which would create circular dependency
function createMockEditor(hasEnabledBuilder: boolean, overrides: Record<string, any> = {}) {
  return {
    hasEnabledBuilderConfig: () => hasEnabledBuilder,
    resolveBuilder: vi.fn(),
    // Stub remaining IMastraEditor interface
    agent: {},
    mcp: {},
    mcpServer: {},
    prompt: {},
    scorer: {},
    workspace: {},
    skill: {},
    registerWithMastra: vi.fn(),
    ...overrides,
  } as any;
}

describe('MastraServer.validateAgentBuilderLicense', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('does not throw when builder is omitted', async () => {
    const mastra = new Mastra({});
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).resolves.not.toThrow();
  });

  it('does not throw when builder.enabled is false', async () => {
    const editor = createMockEditor(false);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).resolves.not.toThrow();
  });

  it('does not throw in dev environment', async () => {
    process.env.NODE_ENV = 'development';

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).resolves.not.toThrow();
  });

  it('does not throw with valid license', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MASTRA_EE_LICENSE = 'a'.repeat(32); // Valid mock license

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).resolves.not.toThrow();
  });

  it('throws with invalid license in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MASTRA_EE_LICENSE;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).rejects.toThrow('[mastra/auth-ee]');
  });

  it('error message mentions Agent Builder', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MASTRA_EE_LICENSE;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    try {
      await adapter.validateAgentBuilderLicense();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('Agent Builder');
    }
  });

  it('error message has correct format', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MASTRA_EE_LICENSE;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    try {
      await adapter.validateAgentBuilderLicense();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/^\[mastra\/auth-ee\]/);
    }
  });
});

describe('MastraServer.preloadBuilder', () => {
  it('calls editor.resolveBuilder() when builder is enabled', async () => {
    const resolveBuilder = vi.fn().mockResolvedValue({ enabled: true });
    const editor = createMockEditor(true, { resolveBuilder });
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.preloadBuilder();

    expect(resolveBuilder).toHaveBeenCalledOnce();
  });

  it('is a no-op when hasEnabledBuilderConfig() returns false', async () => {
    const resolveBuilder = vi.fn();
    const editor = createMockEditor(false, { resolveBuilder });
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.preloadBuilder();

    expect(resolveBuilder).not.toHaveBeenCalled();
  });

  it('is a no-op when no editor is configured', async () => {
    const mastra = new Mastra({});
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.preloadBuilder()).resolves.not.toThrow();
  });

  it('logs and swallows errors from resolveBuilder', async () => {
    const resolveBuilder = vi.fn().mockRejectedValue(new Error('boom'));
    const editor = createMockEditor(true, { resolveBuilder });
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.preloadBuilder()).resolves.not.toThrow();
    expect(resolveBuilder).toHaveBeenCalledOnce();
  });
});
