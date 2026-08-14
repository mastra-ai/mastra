import oracledb from 'oracledb';
import type { Connection, Pool, PoolAttributes } from 'oracledb';

export interface OracleConnectionConfig {
  user?: string;
  password?: string;
  connectString?: string;
  pool?: Pool;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
  configDir?: string;
  walletLocation?: string;
  walletPassword?: string;
  externalAuth?: boolean;
}

type BindParameters = oracledb.BindParameters;

export type ObjectRow = Record<string, unknown>;

export class OraclePoolManager {
  // Pool creation is lazy and memoized so OracleStore and OracleVector can share one manager safely.
  private poolPromise?: Promise<Pool>;
  private readonly poolOptions?: PoolAttributes;
  private readonly ownsPool: boolean;

  constructor(private readonly config: OracleConnectionConfig) {
    validateOracleConnectionConfig(config);
    this.ownsPool = !config.pool;
    if (!config.pool) {
      this.poolOptions = buildPoolOptions(config);
    }
  }

  async getPool(): Promise<Pool> {
    if (this.config.pool) return this.config.pool;
    if (!this.poolOptions) {
      throw new Error('Oracle pool options were not initialized');
    }
    if (!this.poolPromise) {
      // Reset the promise on failure so a transient listener/network issue does not poison the manager forever.
      this.poolPromise = oracledb.createPool(this.poolOptions).catch(error => {
        this.poolPromise = undefined;
        throw error;
      });
    }
    return this.poolPromise;
  }

  async withConnection<T>(callback: (connection: Connection) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const connection = await pool.getConnection();
    try {
      // Transaction ownership stays with the caller; this helper only owns acquire/release.
      return await callback(connection);
    } finally {
      await connection.close();
    }
  }

  async close(): Promise<void> {
    if (this.ownsPool && this.poolPromise) {
      const poolPromise = this.poolPromise;
      this.poolPromise = undefined;
      const pool = await poolPromise;
      await pool.close(0);
    }
  }
}

export function validateOracleConnectionConfig(config: OracleConnectionConfig): void {
  if (!config.pool) {
    // External authentication (OS/Kerberos/wallet TLS) identifies the session
    // without explicit credentials, so user and password may both be omitted.
    if (!config.connectString || (!config.externalAuth && !config.user)) {
      throw new Error('Provide either an Oracle pool or user/connectString credentials');
    }
    if (!config.externalAuth && !config.password) {
      throw new Error('Password is required unless externalAuth is enabled');
    }
  }
}

export function normalizeBatchSize(value: number | undefined, label: string, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

export function buildPoolOptions(config: OracleConnectionConfig): PoolAttributes {
  const options: PoolAttributes = {
    user: config.user,
    password: config.password,
    connectString: config.connectString,
    poolMin: config.poolMin ?? 0,
    poolMax: config.poolMax ?? 4,
    poolIncrement: config.poolIncrement ?? 1,
    externalAuth: config.externalAuth,
  };

  if (config.configDir) options.configDir = config.configDir;
  if (config.walletLocation) options.walletLocation = config.walletLocation;
  if (config.walletPassword) options.walletPassword = config.walletPassword;

  return options;
}

export function executeOptions(): oracledb.ExecuteOptions {
  return {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    // Mastra stores several rich text fields as CLOBs; fetch them as strings to keep domain mappers simple.
    fetchInfo: {
      content: { type: oracledb.STRING as unknown as number },
      instructions: { type: oracledb.STRING as unknown as number },
      description: { type: oracledb.STRING as unknown as number },
      changeMessage: { type: oracledb.STRING as unknown as number },
      other: { type: oracledb.STRING as unknown as number },
      workingMemory: { type: oracledb.STRING as unknown as number },
      activeObservations: { type: oracledb.STRING as unknown as number },
      activeObservationsPendingUpdate: { type: oracledb.STRING as unknown as number },
      bufferedObservations: { type: oracledb.STRING as unknown as number },
      bufferedReflection: { type: oracledb.STRING as unknown as number },
      message: { type: oracledb.STRING as unknown as number },
      reason: { type: oracledb.STRING as unknown as number },
      preprocessPrompt: { type: oracledb.STRING as unknown as number },
      extractPrompt: { type: oracledb.STRING as unknown as number },
      generateScorePrompt: { type: oracledb.STRING as unknown as number },
      generateReasonPrompt: { type: oracledb.STRING as unknown as number },
      analyzePrompt: { type: oracledb.STRING as unknown as number },
      reasonPrompt: { type: oracledb.STRING as unknown as number },
    },
  };
}

export function rows<T extends ObjectRow = ObjectRow>(result: oracledb.Result<T>): T[] {
  return result.rows ?? [];
}

export function asBindParameters(binds: Record<string, unknown>): BindParameters {
  return binds as BindParameters;
}

export function jsonBind(value: unknown): oracledb.BindParameter {
  // Bind JSON as text and let the SERVER encode the OSON image. Images encoded
  // client-side by the node-oracledb thin driver (DB_TYPE_JSON) carry header
  // flags (HASH_ID_UINT8 | TINY_NODES_STAT) that Oracle's own JDBC parser does
  // not implement, so DBeaver/DataGrip/SQL Developer fail to render the rows
  // with UnsupportedOperationException in OsonHeader. The column type stays
  // native JSON; only the text->OSON encoding moves server-side.
  return { type: oracledb.DB_TYPE_VARCHAR, val: jsonBindText(value ?? null) };
}

export function jsonBindText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return sanitizeJsonString(safeJsonStringify(value));
}

export function nullableJsonBind(value: unknown): oracledb.BindParameter | null {
  return value === undefined || value === null ? null : jsonBind(value);
}

export function clobBind(value: string): oracledb.BindParameter {
  return { type: oracledb.DB_TYPE_CLOB, val: value };
}

export function nullableClobBind(value: string | null | undefined): oracledb.BindParameter | null {
  return value === undefined || value === null ? null : { type: oracledb.DB_TYPE_CLOB, val: value };
}

export function safeJsonValue(value: unknown): unknown {
  return JSON.parse(sanitizeJsonString(safeJsonStringify(value))) as unknown;
}

export function safeJsonStringify(value: unknown): string {
  const ancestors = new Set<object>();

  const sanitize = (candidate: unknown): unknown => {
    if (candidate === null || candidate === undefined) return candidate;
    if (typeof candidate === 'function' || typeof candidate === 'symbol') return undefined;
    if (typeof candidate === 'bigint') return candidate.toString();
    if (typeof candidate !== 'object') return candidate;

    // Mastra runtime objects can contain cycles or class instances; keep only JSON-safe values for Oracle JSON columns.
    if (ancestors.has(candidate)) return undefined;

    ancestors.add(candidate);
    try {
      let keys: string[];
      try {
        keys = Object.keys(candidate);
      } catch {
        return undefined;
      }

      const toJSON = (candidate as Record<string, unknown>).toJSON;
      if (typeof toJSON === 'function') {
        try {
          return sanitize((toJSON as () => unknown).call(candidate));
        } catch {
          return undefined;
        }
      }

      if (Array.isArray(candidate)) {
        return candidate.map(item => sanitize(item));
      }

      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const sanitized = sanitize((candidate as Record<string, unknown>)[key]);
        if (sanitized !== undefined) result[key] = sanitized;
      }
      return result;
    } finally {
      ancestors.delete(candidate);
    }
  };

  return JSON.stringify(sanitize(value)) ?? 'null';
}

export function sanitizeJsonString(jsonString: string): string {
  return jsonString
    .replace(/\\\\?u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g, '')
    .replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\');
}

export async function executeDdl(
  connection: Connection,
  ddl: string,
  ignoredErrorCodes: number[] = [],
): Promise<boolean> {
  const retryableLockCodes = [-54, -14411];
  const retryDelays = [100, 250, 500, 1_000, 1_500];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      await connection.execute(ddl);
      return true;
    } catch (error) {
      if (isOracleErrorCode(error, ignoredErrorCodes)) return false;
      // Online DDL can still briefly collide with readers/writers; retry the known Oracle lock codes.
      if (attempt < retryDelays.length && isOracleErrorCode(error, retryableLockCodes)) {
        await sleep(retryDelays[attempt]!);
        continue;
      }
      throw error;
    }
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function rollbackQuietly(connection: Connection): Promise<void> {
  try {
    await connection.rollback();
  } catch {
    // Preserve the original database error.
  }
}

export function isOracleErrorCode(error: unknown, ignoredCodes: number[]): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorCode = 'errorNum' in error ? Number(error.errorNum) : undefined;
  if (errorCode && ignoredCodes.includes(-Math.abs(errorCode))) return true;

  const message = 'message' in error ? String(error.message) : '';
  return ignoredCodes.some(code => message.includes(`ORA-${String(Math.abs(code)).padStart(5, '0')}`));
}
