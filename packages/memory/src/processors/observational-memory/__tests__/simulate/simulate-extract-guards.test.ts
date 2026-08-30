import { describe, expect, it } from 'vitest';

import {
  assertDistinctDatabases,
  assertLocalDatabase,
  assertLocalTarget,
  buildThreadSelection,
  isLocalPostgresUrl,
  parseArgs,
  withLocalDatabase,
} from '../../../../../scripts/simulate/extract';
import {
  armDatabaseUrl,
  cadenceOrOff,
  positiveInt,
  prepareArmTarget,
  recreateDatabase,
} from '../../../../../scripts/simulate/replay';

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

describe('simulate replay — target operation ordering', () => {
  it('attests before dropping or creating an arm database', async () => {
    const events: string[] = [];
    const client = {
      connect: async () => events.push('connect'),
      end: async () => events.push('end'),
      query: async (sql: string) => {
        if (sql.startsWith('SELECT current_database()')) {
          events.push('attest');
          return { rows: [{ database: 'postgres', address: '127.0.0.1', port: 5432 }] };
        }
        events.push(sql.startsWith('DROP DATABASE') ? 'drop' : 'create');
        return { rows: [] };
      },
    };
    await recreateDatabase('postgres://user@127.0.0.1/simulate', () => client);
    expect(events).toEqual(['connect', 'attest', 'drop', 'create', 'end']);
  });

  it('does not alter an arm database when live attestation fails', async () => {
    const destructiveQueries: string[] = [];
    const client = {
      connect: async () => {},
      end: async () => {},
      query: async (sql: string) => {
        if (sql.startsWith('SELECT current_database()')) {
          return { rows: [{ database: 'postgres', address: '203.0.113.9', port: 5432 }] };
        }
        destructiveQueries.push(sql);
        return { rows: [] };
      },
    };
    await expect(recreateDatabase('postgres://user@127.0.0.1/simulate', () => client)).rejects.toThrow(
      /non-local PostgreSQL server/,
    );
    expect(destructiveQueries).toEqual([]);
  });

  it('attests before initializing standalone replay storage', async () => {
    const events: string[] = [];
    await prepareArmTarget('postgres://user@127.0.0.1/simulate', {
      attest: async () => {
        events.push('attest');
      },
      storage: async () => {
        events.push('storage');
        return {} as never;
      },
      vector: async () => {
        events.push('vector');
        return {} as never;
      },
    });
    expect(events).toEqual(['attest', 'storage', 'vector']);
  });

  it('does not initialize standalone replay storage when attestation fails', async () => {
    const events: string[] = [];
    await expect(
      prepareArmTarget('postgres://user@127.0.0.1/simulate', {
        attest: async () => {
          throw new Error('remote target');
        },
        storage: async () => {
          events.push('storage');
          return {} as never;
        },
        vector: async () => {
          events.push('vector');
          return {} as never;
        },
      }),
    ).rejects.toThrow('remote target');
    expect(events).toEqual([]);
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

describe('simulate replay — arm database URLs', () => {
  it('suffixes the database name, not the raw string', () => {
    expect(armDatabaseUrl('postgres://user@127.0.0.1:55432/simulate_run', 'a')).toBe(
      'postgres://user@127.0.0.1:55432/simulate_run_a',
    );
  });

  it('preserves query parameters instead of suffixing them', () => {
    // The bug this guards against: `${prefix}_a` on a URL ending in `?sslmode=disable`
    // produced `sslmode=disable_a`, pointing every arm at the SAME database.
    expect(armDatabaseUrl('postgres://localhost/simulate?sslmode=disable', 'a')).toBe(
      'postgres://localhost/simulate_a?sslmode=disable',
    );
    expect(armDatabaseUrl('postgres://localhost/simulate?sslmode=disable', 'b')).toBe(
      'postgres://localhost/simulate_b?sslmode=disable',
    );
  });

  it('preserves credentials, port, and multiple query params', () => {
    expect(
      armDatabaseUrl('postgres://user:pw@127.0.0.1:55432/simulate?sslmode=disable&application_name=sim', 'control'),
    ).toBe('postgres://user:pw@127.0.0.1:55432/simulate_control?sslmode=disable&application_name=sim');
  });

  it('refuses a prefix with no database name', () => {
    expect(() => armDatabaseUrl('postgres://localhost', 'a')).toThrow(/database name/);
    expect(() => armDatabaseUrl('postgres://localhost/?sslmode=disable', 'a')).toThrow(/database name/);
  });
});

describe('simulate replay — numeric flag parsing', () => {
  it('falls back when the flag is absent', () => {
    expect(positiveInt('cadence', undefined, 3)).toBe(3);
  });

  it('accepts a positive integer', () => {
    expect(positiveInt('cadence', '7', 3)).toBe(7);
  });

  it.each(['abc', '0', '-1', '2.5', ''])('rejects %j instead of silently producing NaN', value => {
    expect(() => positiveInt('cadence', value, 3)).toThrow(/positive integer/);
  });

  it('reads the literal "off" as driver-initiated curation disabled', () => {
    expect(cadenceOrOff('cadence', 'off', 3)).toBe(false);
  });

  it('still parses numbers and still rejects junk', () => {
    expect(cadenceOrOff('cadence', '4', 3)).toBe(4);
    expect(cadenceOrOff('cadence', undefined, 3)).toBe(3);
    // "false"/"none" are not accepted spellings — a typo'd off switch must fail loudly
    // rather than quietly running a cadence-1 arm and reporting it as a no-curation run.
    expect(() => cadenceOrOff('cadence', 'false', 3)).toThrow(/positive integer/);
    expect(() => cadenceOrOff('cadence', 'none', 3)).toThrow(/positive integer/);
  });
});
