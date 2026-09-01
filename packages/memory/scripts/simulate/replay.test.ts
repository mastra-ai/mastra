import { describe, expect, it } from 'vitest';

import { assertLocalTarget } from './extract';
import { armDatabaseUrl, cadenceOrOff, positiveInt, prepareArmTarget, recreateDatabase } from './replay';

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
