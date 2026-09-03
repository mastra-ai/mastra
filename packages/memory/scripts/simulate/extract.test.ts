import { describe, expect, it } from 'vitest';

import {
  assertDistinctDatabases,
  assertLocalDatabase,
  assertLocalTarget,
  buildThreadSelection,
  isLocalPostgresUrl,
  parseArgs,
  withLocalDatabase,
} from './extract';

describe('simulate extract — local target guard', () => {
  it.each([
    'postgres://127.0.0.1/simulate_input',
    'postgres://127.0.0.1:55432/simulate_input',
    'postgres://user@[::1]:55432/simulate_input',
  ])('accepts %s', url => {
    expect(isLocalPostgresUrl(url)).toBe(true);
    expect(() => assertLocalTarget(url)).not.toThrow();
  });

  it.each([
    'postgres://user:pw@ep-something.us-west-2.aws.neon.tech/neondb',
    'postgres://localhost/simulate_input',
    'postgres://notlocalhost/db',
    'postgres://localhost.evil.com:55432/db',
    'postgres://my-localhost/db',
    'postgres://10.0.0.5:5432/db',
    'postgres://127.0.0.1:5432/db?host=203.0.113.9',
    'postgres://127.0.0.1:5432/db?hostaddr=203.0.113.9',
    'postgres://127.0.0.1:5432/db?service=remote',
    'postgres://user@[::1]:5432/db?host=remote.example.com',
    'not a url',
  ])('rejects %s', url => {
    expect(isLocalPostgresUrl(url)).toBe(false);
    expect(() => assertLocalTarget(url)).toThrow(/non-local target/);
  });
});

describe('simulate extract — source/target isolation', () => {
  const client = (identity: { database: string; address: string; port: number }) => ({
    connect: async () => {},
    end: async () => {},
    query: async () => ({ rows: [identity] }),
  });

  it('rejects different URLs that resolve to the same database', async () => {
    const source = client({ database: 'simulate', address: '127.0.0.1', port: 5432 });
    const target = client({ database: 'simulate', address: '127.0.0.1', port: 5432 });
    await expect(assertDistinctDatabases(source, target)).rejects.toThrow(/same database/);
  });

  it('rejects the same local database reached over IPv4 and IPv6', async () => {
    const source = client({ database: 'simulate', address: '127.0.0.1', port: 5432 });
    const target = client({ database: 'simulate', address: '::1', port: 5432 });
    await expect(assertDistinctDatabases(source, target)).rejects.toThrow(/same database/);
  });

  it('allows a distinct local target database', async () => {
    const source = client({ database: 'production', address: '10.0.0.5', port: 5432 });
    const target = client({ database: 'simulate', address: '127.0.0.1', port: 55432 });
    await expect(assertDistinctDatabases(source, target)).resolves.toBeUndefined();
  });

  it.each(['127.0.0.1', '::1'])('accepts a live connection to %s', async address => {
    await expect(assertLocalDatabase(client({ database: 'simulate', address, port: 5432 }))).resolves.toBeUndefined();
  });

  it.each(['203.0.113.9', '10.0.0.5', ''])('rejects a live connection to %j', async address => {
    await expect(assertLocalDatabase(client({ database: 'simulate', address, port: 5432 }))).rejects.toThrow(
      /non-local PostgreSQL server/,
    );
  });

  it('attests the live endpoint before running a target operation', async () => {
    const events: string[] = [];
    const target = {
      connect: async () => {},
      end: async () => {},
      query: async () => {
        events.push('attest');
        return { rows: [{ database: 'simulate', address: '127.0.0.1', port: 5432 }] };
      },
    };
    await withLocalDatabase(target, async () => {
      events.push('write');
    });
    expect(events).toEqual(['attest', 'write']);
  });

  it('does not run a target operation when live endpoint attestation fails', async () => {
    let wrote = false;
    await expect(
      withLocalDatabase(client({ database: 'simulate', address: '203.0.113.9', port: 5432 }), async () => {
        wrote = true;
      }),
    ).rejects.toThrow(/non-local PostgreSQL server/);
    expect(wrote).toBe(false);
  });
});

describe('simulate extract — thread selection', () => {
  it('selects explicit ids', () => {
    const selection = buildThreadSelection({ threadIds: ['a', 'b'] });
    expect(selection.sql).toContain('ANY($1::text[])');
    expect(selection.params).toEqual([['a', 'b']]);
  });

  it('selects the most recent N threads carrying an OM record', () => {
    const selection = buildThreadSelection({ threads: 5 });
    expect(selection.sql).toContain('mastra_observational_memory');
    expect(selection.sql).toContain('LIMIT $1');
    expect(selection.params).toEqual([5]);
  });

  it('refuses both modes at once, and neither', () => {
    expect(() => buildThreadSelection({ threads: 5, threadIds: ['a'] })).toThrow(/exactly one/);
    expect(() => buildThreadSelection({})).toThrow(/exactly one/);
  });

  it('refuses a non-positive thread count', () => {
    expect(() => buildThreadSelection({ threads: 0 })).toThrow(/positive integer/);
    expect(() => buildThreadSelection({ threads: 1.5 })).toThrow(/positive integer/);
  });
});

describe('simulate extract — arg parsing', () => {
  it('collects repeated --thread-id', () => {
    const args = parseArgs(['--source', 's', '--target', 't', '--thread-id', 'a', '--thread-id', 'b']);
    expect(args).toEqual({ source: 's', target: 't', threadIds: ['a', 'b'] });
  });

  it('requires source and target', () => {
    expect(() => parseArgs(['--target', 't'])).toThrow(/--source/);
    expect(() => parseArgs(['--source', 's'])).toThrow(/--target/);
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/unknown flag/);
  });
});
