import { describe, expect, it } from 'vitest';
import { platformSandboxProvider } from './provider.js';

describe('platformSandboxProvider', () => {
  it('keeps template builders on the programmatic PlatformSandbox API', () => {
    const schema = platformSandboxProvider.configSchema!;
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    expect(properties.sandboxProvider).toMatchObject({ enum: ['railway', 'e2b'], default: 'e2b' });
    expect(properties).not.toHaveProperty('template');
  });
});
