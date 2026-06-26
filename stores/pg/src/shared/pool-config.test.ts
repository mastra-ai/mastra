import { describe, it, expect } from 'vitest';

import { buildConnectionStringPoolConfig } from './pool-config';

const defaults = { max: 20, idleTimeoutMillis: 30_000 };

// Regression coverage for https://github.com/mastra-ai/mastra/issues/17307
describe('buildConnectionStringPoolConfig', () => {
  it('lets an explicit ssl object win over an sslmode= URL param', () => {
    const cfg = buildConnectionStringPoolConfig(
      {
        connectionString: 'postgresql://user:pass@localhost:5432/db?sslmode=require',
        ssl: { rejectUnauthorized: false },
      },
      defaults,
    );

    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    // The raw connectionString must not be forwarded, otherwise pg re-parses it
    // and Object.assigns the URL-derived ssl back over our explicit one.
    expect(cfg).not.toHaveProperty('connectionString');
    expect(cfg.host).toBe('localhost');
    expect(String(cfg.port)).toBe('5432');
    expect(cfg.database).toBe('db');
  });

  it('lets an explicit ssl object win over an ssl= URL param', () => {
    const cfg = buildConnectionStringPoolConfig(
      {
        connectionString: 'postgresql://user:pass@localhost:5432/db?ssl=no-verify',
        ssl: { rejectUnauthorized: false },
      },
      defaults,
    );

    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('preserves URL-driven ssl when no explicit ssl is provided', () => {
    const cfg = buildConnectionStringPoolConfig(
      { connectionString: 'postgresql://user:pass@localhost:5432/db?sslmode=require' },
      defaults,
    );

    // pg-connection-string maps sslmode=require to {}; this must be kept rather
    // than clobbered to undefined.
    expect(cfg.ssl).toEqual({});
  });

  it('leaves ssl undefined when neither the URL nor the config set it', () => {
    const cfg = buildConnectionStringPoolConfig(
      { connectionString: 'postgresql://user:pass@localhost:5432/db' },
      defaults,
    );

    expect(cfg.ssl).toBeUndefined();
  });

  it('applies pool defaults and honors explicit overrides', () => {
    const withDefaults = buildConnectionStringPoolConfig(
      { connectionString: 'postgresql://user:pass@localhost:5432/db' },
      defaults,
    );
    expect(withDefaults.max).toBe(20);
    expect(withDefaults.idleTimeoutMillis).toBe(30_000);

    const overridden = buildConnectionStringPoolConfig(
      { connectionString: 'postgresql://user:pass@localhost:5432/db', max: 5, idleTimeoutMillis: 1_000 },
      defaults,
    );
    expect(overridden.max).toBe(5);
    expect(overridden.idleTimeoutMillis).toBe(1_000);
  });
});
