import { createHash } from 'node:crypto';
import { clearLicenseCache, getEETelemetryFallbackDistinctId } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MastraServer } from './index';

const { captureEEEventSpy } = vi.hoisted(() => ({
  captureEEEventSpy: vi.fn(),
}));

vi.mock('@mastra/core/auth/ee', async importActual => {
  const actual = (await importActual()) as Record<string, unknown>;
  return {
    ...actual,
    captureEEEvent: captureEEEventSpy,
  };
});

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
function createMockEditor(hasEnabledBuilder: boolean) {
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
  } as any;
}

describe('MastraServer.validateAgentBuilderLicense', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    clearLicenseCache();
    captureEEEventSpy.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearLicenseCache();
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

  it('captures ee_feature_used event with feature "builder" on success', async () => {
    process.env.NODE_ENV = 'development';

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateAgentBuilderLicense();

    expect(captureEEEventSpy).toHaveBeenCalledWith(
      'ee_feature_used',
      expect.any(String),
      expect.objectContaining({ feature: 'builder' }),
    );
  });

  it('emits the full builder telemetry payload in dev without a license', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MASTRA_EE_LICENSE;
    delete process.env.MASTRA_LICENSE_KEY;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateAgentBuilderLicense();

    expect(captureEEEventSpy).toHaveBeenCalledTimes(1);
    const [event, distinctId, payload] = captureEEEventSpy.mock.calls[0]!;
    expect(event).toBe('ee_feature_used');
    // No license key → no anonymousId → falls back to the hashed-hostname id.
    expect(distinctId).toBe(getEETelemetryFallbackDistinctId());
    expect(payload).toEqual({
      feature: 'builder',
      license_valid: false,
      license_hash: undefined,
      is_dev_environment: true,
    });
  });

  it('uses the license-derived distinct id and hash in production', async () => {
    process.env.NODE_ENV = 'production';
    const licenseKey = 'a'.repeat(32);
    process.env.MASTRA_EE_LICENSE = licenseKey;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateAgentBuilderLicense();

    const expectedHash = createHash('sha256').update(licenseKey).digest('hex').slice(0, 16);

    expect(captureEEEventSpy).toHaveBeenCalledTimes(1);
    const [, distinctId, payload] = captureEEEventSpy.mock.calls[0]!;
    expect(distinctId).toBe(`${expectedHash}-anonymous`);
    expect(payload).toMatchObject({
      feature: 'builder',
      license_valid: true,
      license_hash: expectedHash,
      is_dev_environment: false,
    });
  });

  it('does not capture ee_feature_used when builder is not configured', async () => {
    const mastra = new Mastra({});
    const adapter = new TestMastraServer({ app: {}, mastra });

    await adapter.validateAgentBuilderLicense();

    expect(captureEEEventSpy).not.toHaveBeenCalled();
  });

  it('does not capture ee_feature_used with an invalid production license', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MASTRA_EE_LICENSE;
    delete process.env.MASTRA_LICENSE_KEY;

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).rejects.toThrow('[mastra/auth-ee]');
    expect(captureEEEventSpy).not.toHaveBeenCalled();
  });

  it('does not let telemetry failures break startup', async () => {
    process.env.NODE_ENV = 'development';
    captureEEEventSpy.mockImplementationOnce(() => {
      throw new Error('posthog unavailable');
    });

    const editor = createMockEditor(true);
    const mastra = new Mastra({ editor });
    const adapter = new TestMastraServer({ app: {}, mastra });

    await expect(adapter.validateAgentBuilderLicense()).resolves.not.toThrow();
    expect(captureEEEventSpy).toHaveBeenCalledTimes(1);
  });
});
