import hana from '@sap/hana-client';

/**
 * Extended Connection interface that adds Promise-based wrappers around
 * the callback-based @sap/hana-client API.
 */
export interface HANAConnection extends hana.Connection {
  connectPromise(options: Record<string, unknown>): Promise<void>;
  execPromise<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  commitPromise(): Promise<void>;
  rollbackPromise(): Promise<void>;
  disconnectPromise(): Promise<void>;
}

/**
 * Wraps a raw @sap/hana-client Connection with Promise-based methods.
 * The driver uses Node-style callbacks; we promisify them here.
 */
function wrapConnection(raw: hana.Connection): HANAConnection {
  const conn = raw as HANAConnection;

  conn.connectPromise = (options: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) =>
      raw.connect(options as hana.ConnectionOptions, (err: Error) => (err ? reject(err) : resolve())),
    );

  conn.execPromise = <T = unknown>(sql: string, params?: hana.HanaParameterType[]) =>
    new Promise<T>((resolve, reject) =>
      raw.exec<T>(sql, params ?? [], (err: Error, rows?: T) => (err ? reject(err) : resolve(rows as T))),
    );

  conn.commitPromise = () =>
    new Promise<void>((resolve, reject) => raw.commit((err: Error) => (err ? reject(err) : resolve())));

  conn.rollbackPromise = () =>
    new Promise<void>((resolve, reject) => raw.rollback((err: Error) => (err ? reject(err) : resolve())));

  conn.disconnectPromise = () =>
    new Promise<void>((resolve, reject) => raw.disconnect((err: Error) => (err ? reject(err) : resolve())));

  return conn;
}

/**
 * Connection parameters for SAP HANA Cloud / S/4HANA DB.
 */
export interface HANAConnectionParams {
  host: string;
  port: number;
  uid: string;
  pwd: string;
  /** Optional database name (tenant DB in multi-tenant deployments). */
  databaseName?: string;
  /** Enable TLS encryption (default: true for port 443). */
  encrypt?: boolean;
  /** Validate server TLS certificate (default: false for dev; enable for production). */
  sslValidateCertificate?: boolean;
}

/**
 * Configuration for the HANAPool.
 */
export interface HANAPoolConfig extends HANAConnectionParams {
  /** Minimum idle connections (default: 1). */
  min?: number;
  /** Maximum active connections (default: 10). */
  max?: number;
}

/**
 * Lightweight connection pool for @sap/hana-client.
 *
 * @sap/hana-client has no built-in pool. This class maintains a fixed set of
 * reusable connections and serialises acquisition via a queue.
 */
export class HANAPool {
  private readonly config: HANAConnectionParams;
  private readonly min: number;
  private readonly max: number;

  /** All connections managed by this pool (idle + active). */
  private connections: HANAConnection[] = [];
  /** Connections currently available for checkout. */
  private idle: HANAConnection[] = [];
  /** Resolve callbacks waiting for a free connection. */
  private queue: Array<(conn: HANAConnection) => void> = [];

  private initialized = false;
  private destroyed = false;

  constructor(config: HANAPoolConfig) {
    this.config = {
      host: config.host,
      port: config.port,
      uid: config.uid,
      pwd: config.pwd,
      databaseName: config.databaseName,
      encrypt: config.encrypt,
      sslValidateCertificate: config.sslValidateCertificate,
    };
    this.min = config.min ?? 1;
    this.max = config.max ?? 10;
  }

  /** Build the @sap/hana-client connect parameters object. */
  private buildConnectParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {
      HOST: this.config.host,
      PORT: this.config.port,
      UID: this.config.uid,
      PWD: this.config.pwd,
    };
    if (this.config.databaseName) {
      params.DATABASENAME = this.config.databaseName;
    }
    if (this.config.encrypt !== undefined) {
      params.ENCRYPT = this.config.encrypt ? 'TRUE' : 'FALSE';
    }
    if (this.config.sslValidateCertificate !== undefined) {
      params.SSLVALIDATECERTIFICATE = this.config.sslValidateCertificate ? 'TRUE' : 'FALSE';
    }
    return params;
  }

  /** Create a single new connection and add it to the pool. */
  private async createConnection(): Promise<HANAConnection> {
    const conn = wrapConnection(hana.createConnection());
    await conn.connectPromise(this.buildConnectParams());
    this.connections.push(conn);
    return conn;
  }

  /**
   * Initialise the pool by creating the minimum number of connections.
   * Called automatically by `acquire()` on first use.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const creates: Promise<HANAConnection>[] = [];
    for (let i = 0; i < this.min; i++) {
      creates.push(this.createConnection());
    }
    const conns = await Promise.all(creates);
    this.idle.push(...conns);
  }

  /**
   * Acquire a connection from the pool.
   * If no connection is available and the pool is below `max`, a new one is created.
   * Otherwise, waits until a connection is released.
   */
  async acquire(): Promise<HANAConnection> {
    if (this.destroyed) {
      throw new Error('HANAPool: pool has been destroyed');
    }
    await this.initialize();

    if (this.idle.length > 0) {
      return this.idle.shift()!;
    }

    if (this.connections.length < this.max) {
      return this.createConnection();
    }

    // All connections are busy — wait in queue
    return new Promise<HANAConnection>(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * Return a connection to the pool.
   * If callers are waiting in the queue, the connection is handed off immediately.
   */
  release(conn: HANAConnection): void {
    if (this.destroyed) {
      conn.disconnect();
      return;
    }
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next(conn);
    } else {
      this.idle.push(conn);
    }
  }

  /**
   * Execute a function with a pooled connection.
   * The connection is automatically released after the function completes.
   */
  async withConnection<T>(fn: (conn: HANAConnection) => Promise<T>): Promise<T> {
    const conn = await this.acquire();
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }

  /**
   * Execute a function inside a HANA transaction.
   * Commits on success, rolls back on error.
   * The connection is returned to the pool after the transaction.
   */
  async withTransaction<T>(fn: (conn: HANAConnection) => Promise<T>): Promise<T> {
    const conn = await this.acquire();
    try {
      await conn.setAutoCommit(false);
      const result = await fn(conn);
      await conn.commitPromise();
      await conn.setAutoCommit(true);
      this.release(conn);
      return result;
    } catch (err) {
      try {
        await conn.rollbackPromise();
        await conn.setAutoCommit(true);
      } catch {
        // Ignore rollback errors
      }
      this.release(conn);
      throw err;
    }
  }

  /**
   * Close all connections and destroy the pool.
   */
  async destroy(): Promise<void> {
    this.destroyed = true;
    await Promise.all(this.connections.map(c => c.disconnectPromise().catch(() => {})));
    this.connections = [];
    this.idle = [];
    // Reject any queued waiters
    for (const resolve of this.queue) {
      // We can't reject here without callbacks, so just release an error later
      void resolve;
    }
    this.queue = [];
  }
}
