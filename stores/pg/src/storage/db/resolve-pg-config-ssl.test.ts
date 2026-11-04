import { Client } from 'pg';
import type { ClientConfig } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import type { PoolAdapter } from '../client';
import { resolvePgConfig } from '.';

const url = 'postgresql://user:pass@db.example.com:5433/mydb?sslmode=require';

describe('resolvePgConfig ssl precedence', () => {
  const adapters: PoolAdapter[] = [];
  const poolOf = (config: Parameters<typeof resolvePgConfig>[0]) => {
    const adapter = resolvePgConfig(config).client as PoolAdapter;
    adapters.push(adapter);
    return adapter.$pool as unknown as { options: Record<string, unknown> };
  };

  afterEach(async () => {
    await Promise.all(adapters.splice(0).map(a => a.$pool.end()));
  });

  it('lets an explicit ssl object win over sslmode= in the connection string', () => {
    const pool = poolOf({ connectionString: url, ssl: { rejectUnauthorized: false } });
    // pg.Client re-parses connectionString and overwrites ssl, so assert what a client actually uses.
    const client = new Client(pool.options as ClientConfig) as unknown as { connectionParameters: { ssl: unknown } };
    expect(client.connectionParameters.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('keeps URL-derived ssl when no explicit ssl is given', () => {
    const pool = poolOf({ connectionString: url });
    expect(pool.options.ssl).toBeTruthy();
  });

  it('forwards connection fields parsed from the URL', () => {
    const pool = poolOf({ connectionString: url, ssl: false });
    expect(pool.options).toMatchObject({ host: 'db.example.com', user: 'user', database: 'mydb', ssl: false });
    expect(String(pool.options.port)).toBe('5433');
  });
});
