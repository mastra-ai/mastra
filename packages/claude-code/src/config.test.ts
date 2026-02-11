import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from './config.js';

describe('resolveConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it('returns defaults when no overrides', () => {
    const config = resolveConfig();
    expect(config.memoryDir).toBe('.mastra/memory');
    expect(config.observationThreshold).toBe(80_000);
    expect(config.reflectionThreshold).toBe(40_000);
    expect(config.model).toBe('claude-sonnet-4-20250514');
    expect(config.debug).toBe(false);
  });

  it('applies overrides', () => {
    const config = resolveConfig({
      observationThreshold: 50_000,
      reflectionThreshold: 25_000,
      debug: true,
    });

    expect(config.observationThreshold).toBe(50_000);
    expect(config.reflectionThreshold).toBe(25_000);
    expect(config.debug).toBe(true);
  });

  it('env vars take priority over overrides', () => {
    process.env.MASTRA_OM_OBSERVATION_THRESHOLD = '100000';
    process.env.MASTRA_OM_DEBUG = 'true';

    const config = resolveConfig({
      observationThreshold: 50_000,
      debug: false,
    });

    expect(config.observationThreshold).toBe(100_000);
    expect(config.debug).toBe(true);
  });

  it('handles invalid env var values', () => {
    process.env.MASTRA_OM_OBSERVATION_THRESHOLD = 'not-a-number';

    const config = resolveConfig();
    expect(config.observationThreshold).toBe(80_000); // Falls back to default
  });
});
