import oracledb from 'oracledb';
import { describe, expect, it, vi } from 'vitest';

import {
  OraclePoolManager,
  buildPoolOptions,
  clobBind,
  executeDdl,
  isOracleErrorCode,
  jsonBind,
  jsonBindText,
  normalizeBatchSize,
  nullableClobBind,
  nullableJsonBind,
  rollbackQuietly,
  rows,
  safeJsonStringify,
  safeJsonValue,
  sanitizeJsonString,
  validateOracleConnectionConfig,
} from './connection';

// Fallback literals keep these unit tests hermetic: CI runs them without any
// Oracle environment, and none of the cases below open a real connection.
const user = process.env.ORACLE_DATABASE_USER ?? 'mastra_test';
const password = process.env.ORACLE_DATABASE_PASSWORD ?? 'mastra_test_password';
const connectString = process.env.ORACLE_DATABASE_CONNECT_STRING ?? 'localhost:1521/FREEPDB1';

describe('Oracle shared connection helpers', () => {
  it('loads node-oracledb in its default Thin mode', () => {
    expect(oracledb.thin).toBe(true);
  });

  it('uses external pools without owning their lifecycle', async () => {
    const connectionClose = vi.fn(async () => undefined);
    const pool = {
      getConnection: vi.fn(async () => ({ close: connectionClose })),
      close: vi.fn(async () => undefined),
    };
    const manager = new OraclePoolManager({ pool: pool as any });

    await expect(manager.getPool()).resolves.toBe(pool);
    await expect(manager.withConnection(async connection => connection)).resolves.toMatchObject({
      close: connectionClose,
    });
    await manager.close();

    expect(connectionClose).toHaveBeenCalledOnce();
    expect(pool.close).not.toHaveBeenCalled();
  });

  it('validates config, pool options, batch sizes, and bind helpers', () => {
    expect(() => validateOracleConnectionConfig({})).toThrow(/credentials/i);
    expect(() => validateOracleConnectionConfig({ user, connectString })).toThrow(/Password/i);
    expect(() => validateOracleConnectionConfig({ user, connectString, externalAuth: true })).not.toThrow();
    expect(() => validateOracleConnectionConfig({ connectString, externalAuth: true })).not.toThrow();
    expect(() => validateOracleConnectionConfig({ user, externalAuth: true })).toThrow(/credentials/i);
    expect(normalizeBatchSize(undefined, 'batch', 25)).toBe(25);
    expect(() => normalizeBatchSize(0, 'batch', 25)).toThrow(/positive integer/i);
    const poolOptions = buildPoolOptions({
      user,
      password,
      connectString,
      configDir: '/cfg',
      walletLocation: '/wallet',
      walletPassword: process.env.ORACLE_DATABASE_WALLET_PASSWORD,
      poolMin: 1,
      poolMax: 2,
      poolIncrement: 1,
    });
    expect(poolOptions).toMatchObject({
      user,
      configDir: '/cfg',
      walletLocation: '/wallet',
      poolMin: 1,
      poolMax: 2,
    });
    expect(poolOptions.walletPassword).toBe(process.env.ORACLE_DATABASE_WALLET_PASSWORD || undefined);

    expect(rows({} as any)).toEqual([]);
    // JSON is bound as text so the server encodes the OSON image (JDBC interop).
    expect(jsonBind({ a: 1 })).toMatchObject({ val: '{"a":1}' });
    expect(jsonBind(undefined)).toMatchObject({ val: null });
    expect(nullableJsonBind(undefined)).toBeNull();
    expect(nullableJsonBind(null)).toBeNull();
    expect(nullableClobBind(undefined)).toBeNull();
    expect(nullableClobBind(null)).toBeNull();
    expect(nullableClobBind('x')).toMatchObject({ val: 'x' });
    expect(clobBind('text')).toMatchObject({ val: 'text' });

    expect(jsonBindText(null)).toBeNull();
    expect(jsonBindText(undefined)).toBeNull();
    expect(jsonBindText({ a: 1, nested: { b: 2 } })).toBe('{"a":1,"nested":{"b":2}}');
    const largeObject = { items: Array.from({ length: 5_000 }, (_, index) => ({ index, value: `item-${index}` })) };
    const largeJsonText = jsonBindText(largeObject);
    expect(largeJsonText).toBe(JSON.stringify(largeObject));
    expect(JSON.parse(largeJsonText as string)).toEqual(largeObject);
  });

  it('sanitizes JSON values and recognizes Oracle error shapes', () => {
    const circular: Record<string, unknown> = { keep: true };
    circular.self = circular;
    circular.big = 10n;
    circular.fn = () => undefined;
    circular.symbol = Symbol('skip');
    circular.child = {
      toJSON() {
        return { ok: true };
      },
    };

    expect(safeJsonValue(circular)).toMatchObject({ keep: true, big: '10', child: { ok: true } });
    expect(
      safeJsonStringify({
        toJSON() {
          throw new Error('bad toJSON');
        },
      }),
    ).toBe('null');
    expect(sanitizeJsonString('{"bad":"\\u0000","slash":"\\q"}')).toContain('\\\\q');
    expect(isOracleErrorCode(null, [-942])).toBe(false);
    expect(isOracleErrorCode({ errorNum: 942 }, [-942])).toBe(true);
    expect(isOracleErrorCode({}, [-942])).toBe(false);
    expect(isOracleErrorCode(new Error('ORA-00942: table missing'), [-942])).toBe(true);
    expect(isOracleErrorCode(new Error('no match'), [-942])).toBe(false);
  });

  it('fails fast when lazy pool options are unavailable', async () => {
    const manager = new OraclePoolManager({ user, password, connectString, externalAuth: !password });
    (manager as any).poolOptions = undefined;

    await expect(manager.getPool()).rejects.toThrow(/pool options/i);
  });

  it('handles DDL ignore, retry, failure, and quiet rollback paths', async () => {
    const ignoredConnection = {
      execute: vi.fn(async () => {
        throw Object.assign(new Error('ORA-00955: name is already used'), { errorNum: 955 });
      }),
    };
    await expect(executeDdl(ignoredConnection as any, 'CREATE TABLE X (id NUMBER)', [-955])).resolves.toBe(false);

    vi.useFakeTimers();
    try {
      const retryError = Object.assign(new Error('ORA-00054: resource busy'), { errorNum: 54 });
      const retryConnection = {
        execute: vi
          .fn()
          .mockRejectedValueOnce(retryError)
          .mockRejectedValueOnce(retryError)
          .mockResolvedValueOnce({}),
      };
      const retryPromise = executeDdl(retryConnection as any, 'CREATE INDEX X ON T (id)');
      await vi.advanceTimersByTimeAsync(350);
      await expect(retryPromise).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }

    await expect(
      executeDdl(
        {
          execute: vi.fn(async () => {
            throw new Error('boom');
          }),
        } as any,
        'CREATE TABLE X (id NUMBER)',
      ),
    ).rejects.toThrow(/boom/);

    await expect(rollbackQuietly({ rollback: vi.fn(async () => undefined) } as any)).resolves.toBeUndefined();
    await expect(
      rollbackQuietly({
        rollback: vi.fn(async () => {
          throw new Error('rollback failed');
        }),
      } as any),
    ).resolves.toBeUndefined();
  });
});
